//! Paying for nine turtles, through Dodo Payments (SPEC section 29,
//! decisions 0083 and 0094).
//!
//! Dodo Payments is the "merchant of record": it sells nine turtles on the
//! owner's behalf, takes the card, adds sales tax and sends receipts. nine
//! turtles never sees a card. It only:
//!
//! - **asks Dodo for a checkout page** (`POST /api/plan/checkout`), monthly
//!   or yearly, and sends the reader there; Dodo sends them back to Settings;
//! - **asks Dodo for the reader's billing page** (`POST /api/plan/manage`),
//!   where they change their card, see receipts or cancel;
//! - **listens to Dodo's messages** (`POST /payments/dodo`), signed with the
//!   webhook secret (the Standard Webhooks way), and keeps its own record of
//!   each reader's subscription in `plans`;
//! - **cancels a reader's subscription** when they delete their account.
//!
//! **Off by default:** without the Dodo settings (`Settings`), nobody pays,
//! nothing is limited, Settings shows no plan, and `/payments/dodo` answers
//! "not found". **Test mode** unless `NINE_TURTLES_DODO_MODE` is `live`.
//!
//! **Who pays:** never the owner, nor anyone who joined before payments
//! (`people.free`). Everyone else has a free trial of `trial_days` from when
//! they joined (or from when payments were switched on, if later), then
//! needs a plan. A renewal that fails keeps the plan for `GRACE` while Dodo
//! tries the card again; a cancelled plan lasts to the end of what was paid.
//!
//! **When a plan has ended** (the reader's *standing* is `Ended`): the reader
//! still reads, stars, searches and exports everything they have, and can
//! delete their account; they can't add feeds, and their feeds are checked
//! once a day, as for a reader who is away (`admin::AWAY_WAIT`).

use axum::{
    Json, Router,
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use hmac::{Hmac, KeyInit, Mac};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::SqlitePool;

use crate::{
    AppState,
    auth::{SignedIn, database_problem},
    checking::DAY,
    dates::parse_rfc3339,
    encoding::from_base64,
    log, now, refused,
};

/// How long a plan whose renewal failed lasts while Dodo tries again.
pub const GRACE: i64 = 7 * DAY;
/// The free trial when `NINE_TURTLES_TRIAL_DAYS` isn't set.
pub const DEFAULT_TRIAL_DAYS: i64 = 14;
/// What Settings says for a price not set yet.
pub const PRICE_NOT_SET: &str = "Price to be decided";
/// How far a message's time may be from now (the Standard Webhooks rule).
const MESSAGE_TOLERANCE: i64 = 5 * 60;
/// How long the ids of handled messages are kept.
const MESSAGES_KEPT: i64 = 90 * DAY;
/// Dodo's addresses for test mode and live mode.
pub const TEST_API: &str = "https://test.dodopayments.com";
pub const LIVE_API: &str = "https://live.dodopayments.com";
/// How long one request to Dodo may take.
const TIME_LIMIT: std::time::Duration = std::time::Duration::from_secs(20);

/// The Dodo settings (`NINE_TURTLES_DODO_*`, `NINE_TURTLES_PRICE_*`,
/// `NINE_TURTLES_TRIAL_DAYS`). Never written to a log or a page.
#[derive(Clone)]
pub struct Settings {
    pub api_key: String,
    /// The webhook secret's key, decoded from its `whsec_…` text.
    pub webhook_key: Vec<u8>,
    /// Dodo's product ids for each plan (`pdt_…`); yearly is optional.
    pub monthly_product: String,
    pub yearly_product: Option<String>,
    /// `TEST_API` or `LIVE_API`; a test points it at its own stand-in.
    pub api_url: reqwest::Url,
    pub live: bool,
    /// The prices as Settings shows them, such as "$5 a month".
    pub monthly_price: String,
    pub yearly_price: Option<String>,
    pub trial_days: i64,
}

impl std::fmt::Debug for Settings {
    // Only what is safe to show: never the key or the secret.
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Settings")
            .field("live", &self.live)
            .field("trial_days", &self.trial_days)
            .finish_non_exhaustive()
    }
}

/// Reads the Dodo settings: key, webhook secret and monthly product, or
/// none (payments off). Some but not all is a slip worth stopping for.
pub fn settings(var: &dyn Fn(&str) -> Option<String>) -> Result<Option<Settings>, String> {
    let names = [
        "NINE_TURTLES_DODO_API_KEY",
        "NINE_TURTLES_DODO_WEBHOOK_SECRET",
        "NINE_TURTLES_DODO_MONTHLY_PRODUCT",
    ];
    let values: Vec<Option<String>> = names
        .iter()
        .map(|name| var(name).map(|value| value.trim().to_owned()))
        .collect();
    if values.iter().all(Option::is_none) {
        return Ok(None);
    }
    let missing: Vec<&str> = names
        .iter()
        .zip(&values)
        .filter(|(_, value)| value.is_none())
        .map(|(name, _)| *name)
        .collect();
    if !missing.is_empty() {
        return Err(format!(
            "payments need the Dodo API key, webhook secret and monthly product; missing: {} \
             (docs/operations/payments.md)",
            missing.join(", ")
        ));
    }
    let [api_key, secret, monthly_product] =
        <[Option<String>; 3]>::try_from(values).map_err(|_| "three settings".to_owned())?;
    let secret = secret.unwrap_or_default();
    let webhook_key = webhook_key(&secret).ok_or_else(|| {
        "NINE_TURTLES_DODO_WEBHOOK_SECRET must be the whole secret Dodo shows, starting whsec_ \
         (docs/operations/payments.md)"
            .to_owned()
    })?;
    let live = match var("NINE_TURTLES_DODO_MODE").map(|mode| mode.trim().to_lowercase()) {
        None => false,
        Some(mode) if mode == "test" => false,
        Some(mode) if mode == "live" => true,
        Some(mode) => {
            return Err(format!(
                "NINE_TURTLES_DODO_MODE must be test or live, got {mode:?}"
            ));
        }
    };
    let trial_days = match var("NINE_TURTLES_TRIAL_DAYS") {
        None => DEFAULT_TRIAL_DAYS,
        Some(text) => text
            .trim()
            .parse::<i64>()
            .ok()
            .filter(|days| (0..=365).contains(days))
            .ok_or_else(|| {
                format!("NINE_TURTLES_TRIAL_DAYS must be a number of days such as 14, got {text:?}")
            })?,
    };
    let api_url = reqwest::Url::parse(if live { LIVE_API } else { TEST_API })
        .map_err(|error| format!("Dodo's address: {error}"))?;
    Ok(Some(Settings {
        api_key: api_key.unwrap_or_default(),
        webhook_key,
        monthly_product: monthly_product.unwrap_or_default(),
        yearly_product: var("NINE_TURTLES_DODO_YEARLY_PRODUCT").map(|id| id.trim().to_owned()),
        api_url,
        live,
        monthly_price: var("NINE_TURTLES_PRICE_MONTHLY")
            .map_or_else(|| PRICE_NOT_SET.to_owned(), |price| price.trim().to_owned()),
        yearly_price: var("NINE_TURTLES_PRICE_YEARLY").map(|price| price.trim().to_owned()),
        trial_days,
    }))
}

/// The signing key in a webhook secret: base64 after `whsec_`.
pub fn webhook_key(secret: &str) -> Option<Vec<u8>> {
    let key = from_base64(secret.trim().strip_prefix("whsec_")?)?;
    (!key.is_empty()).then_some(key)
}

/// Where a reader stands, for paying.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "standing", rename_all = "kebab-case")]
pub enum Standing {
    /// Never pays: the owner, or someone who joined before payments.
    Free,
    /// In the free trial, until `ends_at`.
    Trial { ends_at: i64 },
    /// Paid up. `renews_at` is the next charge; `ending` when cancelled,
    /// and then the plan stops at `until`.
    Paid {
        until: i64,
        renews_at: Option<i64>,
        ending: bool,
        period: Option<String>,
    },
    /// A renewal failed; Dodo tries the card again. The plan lasts to `until`.
    OnHold { until: i64 },
    /// The trial or the plan has ended.
    Ended,
}

impl Standing {
    pub fn has_ended(&self) -> bool {
        matches!(self, Self::Ended)
    }
}

#[derive(sqlx::FromRow)]
struct PlanRow {
    period: Option<String>,
    status: String,
    renews_at: Option<i64>,
    ending: i64,
    access_until: i64,
}

/// Where reader `person` stands at `now`. Everyone is `Free` while
/// payments are off.
pub async fn standing(state: &AppState, person: i64, now: i64) -> Result<Standing, sqlx::Error> {
    let Some(settings) = &state.config.payments else {
        return Ok(Standing::Free);
    };
    standing_in(&state.db, settings.trial_days, person, now).await
}

async fn standing_in(
    db: &SqlitePool,
    trial_days: i64,
    person: i64,
    now: i64,
) -> Result<Standing, sqlx::Error> {
    let found: Option<(i64, i64, i64)> =
        sqlx::query_as("SELECT owner, free, created_at FROM people WHERE id = ?")
            .bind(person)
            .fetch_optional(db)
            .await?;
    let Some((owner, free, joined)) = found else {
        return Ok(Standing::Ended);
    };
    if owner == 1 || free == 1 {
        return Ok(Standing::Free);
    }
    let plan: Option<PlanRow> = sqlx::query_as(
        "SELECT period, status, renews_at, ending, access_until FROM plans WHERE person_id = ?",
    )
    .bind(person)
    .fetch_optional(db)
    .await?;
    if let Some(plan) = plan.filter(|plan| plan.access_until > now) {
        return Ok(if plan.status == "on_hold" {
            Standing::OnHold {
                until: plan.access_until,
            }
        } else {
            Standing::Paid {
                until: plan.access_until,
                renews_at: plan.renews_at.filter(|_| plan.ending == 0),
                ending: plan.ending == 1,
                period: plan.period,
            }
        });
    }
    let started = joined.max(switched_on_at(db).await?.unwrap_or(joined));
    let ends_at = started + trial_days * DAY;
    Ok(if now < ends_at {
        Standing::Trial { ends_at }
    } else {
        Standing::Ended
    })
}

/// When payments were first switched on here, so readers who joined while
/// they were off get their whole trial from then.
async fn switched_on_at(db: &SqlitePool) -> Result<Option<i64>, sqlx::Error> {
    let value: Option<String> =
        sqlx::query_scalar("SELECT value FROM settings WHERE name = 'payments_on_at'")
            .fetch_optional(db)
            .await?;
    Ok(value.and_then(|value| value.parse().ok()))
}

/// Notes when payments were first switched on (`switched_on_at`), once.
pub async fn note_switched_on(db: &SqlitePool, now: i64) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT OR IGNORE INTO settings (name, value) VALUES ('payments_on_at', ?)")
        .bind(now.to_string())
        .execute(db)
        .await?;
    Ok(())
}

/// Whether reader `person` may add feeds: not when their plan has ended.
pub async fn may_add_feeds(state: &AppState, person: i64) -> Result<bool, sqlx::Error> {
    Ok(!standing(state, person, now()).await?.has_ended())
}

/// Whether the feed has a follower whose plan hasn't ended. While payments
/// are off, always yes.
pub async fn followed_by_someone_current(
    state: &AppState,
    feed_id: i64,
    now: i64,
) -> Result<bool, sqlx::Error> {
    if state.config.payments.is_none() {
        return Ok(true);
    }
    let followers: Vec<i64> = sqlx::query_scalar(
        "SELECT person_id FROM subscriptions WHERE feed_id = ? AND unsubscribed_at IS NULL",
    )
    .bind(feed_id)
    .fetch_all(&state.db)
    .await?;
    for person in followers {
        if !standing(state, person, now).await?.has_ended() {
            return Ok(true);
        }
    }
    Ok(false)
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/plan", get(plan))
        .route("/api/plan/checkout", post(checkout))
        .route("/api/plan/manage", post(manage))
        .route("/payments/dodo", post(message))
}

/// The reader's plan, for Settings › Your plan.
async fn plan(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let Some(settings) = &state.config.payments else {
        return Json(json!({ "on": false })).into_response();
    };
    let standing = match standing(&state, person, now()).await {
        Ok(standing) => standing,
        Err(error) => return database_problem("reading a reader's plan", &error),
    };
    let customer: Result<Option<String>, sqlx::Error> =
        sqlx::query_scalar("SELECT customer_id FROM plans WHERE person_id = ?")
            .bind(person)
            .fetch_optional(&state.db)
            .await;
    let customer = match customer {
        Ok(customer) => customer,
        Err(error) => return database_problem("reading a reader's plan", &error),
    };
    Json(json!({
        "on": true,
        "test_mode": !settings.live,
        "plan": standing,
        "prices": {
            "monthly": settings.monthly_price,
            "yearly": settings.yearly_product.as_ref().map(|_| {
                settings.yearly_price.clone().unwrap_or_else(|| PRICE_NOT_SET.to_owned())
            }),
        },
        "can_manage": customer.is_some(),
    }))
    .into_response()
}

#[derive(Deserialize)]
struct Checkout {
    period: String,
}

/// Dodo couldn't be reached, or said no: logged, and a calm answer.
fn dodo_problem(doing: &str, detail: &str) -> Response {
    log::problem(&format!("Dodo Payments: couldn't {doing}: {detail}"));
    refused(StatusCode::BAD_GATEWAY, "payments-unreachable")
}

/// A Dodo checkout page for the plan chosen. A reader still in their trial
/// keeps its remaining days: the first charge comes when it would have ended.
async fn checkout(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(form): Json<Checkout>,
) -> Response {
    let Some(settings) = &state.config.payments else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let product = match form.period.as_str() {
        "monthly" => settings.monthly_product.clone(),
        "yearly" => match &settings.yearly_product {
            Some(product) => product.clone(),
            None => return refused(StatusCode::BAD_REQUEST, "no-such-plan"),
        },
        _ => return refused(StatusCode::BAD_REQUEST, "no-such-plan"),
    };
    let now = now();
    let trial_days_left = match standing(&state, person, now).await {
        Ok(Standing::Free) => return refused(StatusCode::CONFLICT, "free"),
        Ok(Standing::Paid { ending: false, .. } | Standing::OnHold { .. }) => {
            return refused(StatusCode::CONFLICT, "already");
        }
        // Whole days, rounded up, so the first charge never comes before
        // the day Settings showed for the trial's end.
        Ok(Standing::Trial { ends_at }) => (ends_at - now + DAY - 1).div_euclid(DAY).max(0),
        Ok(Standing::Paid { .. } | Standing::Ended) => 0,
        Err(error) => return database_problem("reading a reader's plan", &error),
    };
    let email: Result<Option<String>, sqlx::Error> =
        sqlx::query_scalar("SELECT email FROM people WHERE id = ?")
            .bind(person)
            .fetch_one(&state.db)
            .await;
    let email = match email {
        Ok(Some(email)) => email,
        Ok(None) => return refused(StatusCode::CONFLICT, "no-email"),
        Err(error) => return database_problem("reading a reader's email", &error),
    };
    let mut body = json!({
        "product_cart": [{ "product_id": product, "quantity": 1 }],
        "customer": { "email": email, "name": email },
        "return_url": settings_page(&state),
        "metadata": { "person_id": person.to_string() },
    });
    if trial_days_left > 0 {
        body["subscription_data"] = json!({ "trial_period_days": trial_days_left });
    }
    match ask_dodo(
        settings,
        reqwest::Method::POST,
        "checkouts",
        &[],
        Some(&body),
    )
    .await
    {
        Ok(answer) => match answer.get("checkout_url").and_then(Value::as_str) {
            Some(url) => Json(json!({ "url": url })).into_response(),
            None => dodo_problem("start a checkout", "its answer had no checkout_url"),
        },
        Err(error) => dodo_problem("start a checkout", &error.detail),
    }
}

/// Dodo's billing page for the reader: card, receipts, cancelling.
async fn manage(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    let Some(settings) = &state.config.payments else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let customer: Result<Option<String>, sqlx::Error> =
        sqlx::query_scalar("SELECT customer_id FROM plans WHERE person_id = ?")
            .bind(person)
            .fetch_optional(&state.db)
            .await;
    let customer = match customer {
        Ok(Some(customer)) => customer,
        Ok(None) => return refused(StatusCode::CONFLICT, "no-plan"),
        Err(error) => return database_problem("reading a reader's plan", &error),
    };
    let path = format!("customers/{customer}/customer-portal/session");
    let back = settings_page(&state);
    let query = [("return_url", back.as_str())];
    match ask_dodo(settings, reqwest::Method::POST, &path, &query, None).await {
        Ok(answer) => match answer.get("link").and_then(Value::as_str) {
            Some(url) => Json(json!({ "url": url })).into_response(),
            None => dodo_problem("open the billing page", "its answer had no link"),
        },
        Err(error) => dodo_problem("open the billing page", &error.detail),
    }
}

/// Where Dodo sends the reader back to: Settings › Your plan (decision 0120).
fn settings_page(state: &AppState) -> String {
    state.config.public_url.as_ref().map_or_else(
        || "/settings/plan".to_owned(),
        |base| {
            base.join("/settings/plan")
                .map_or_else(|_| base.to_string(), |url| url.to_string())
        },
    )
}

/// What went wrong asking Dodo: its answer's status, if it answered.
#[derive(Debug)]
pub struct DodoError {
    pub status: Option<u16>,
    pub detail: String,
}

impl std::fmt::Display for DodoError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.detail)
    }
}

impl From<String> for DodoError {
    fn from(detail: String) -> Self {
        Self {
            status: None,
            detail,
        }
    }
}

/// One request to Dodo's API; its answer, or what went wrong (never the key).
async fn ask_dodo(
    settings: &Settings,
    method: reqwest::Method,
    path: &str,
    query: &[(&str, &str)],
    body: Option<&Value>,
) -> Result<Value, DodoError> {
    let mut url = settings
        .api_url
        .join(path)
        .map_err(|error| DodoError::from(format!("bad address {path:?}: {error}")))?;
    if !query.is_empty() {
        url.query_pairs_mut().extend_pairs(query);
    }
    let client = reqwest::Client::builder()
        .timeout(TIME_LIMIT)
        .user_agent(crate::fetch::USER_AGENT)
        .build()
        .map_err(|error| DodoError::from(error.to_string()))?;
    let mut request = client.request(method, url).bearer_auth(&settings.api_key);
    if let Some(body) = body {
        request = request
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(body.to_string());
    }
    let response = request.send().await.map_err(|error| {
        // Without the address: reqwest's errors name it, and that's enough.
        DodoError::from(format!("no answer ({})", error.without_url()))
    })?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    if !status.is_success() {
        let shown: String = text.chars().take(200).collect();
        return Err(DodoError {
            status: Some(status.as_u16()),
            detail: format!("it answered {status}: {shown}"),
        });
    }
    if text.trim().is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&text)
        .map_err(|error| DodoError::from(format!("its answer wasn't JSON: {error}")))
}

/// Cancels reader `person`'s subscription at once, if they have one that
/// would charge again; used before their account is deleted. Payments off,
/// or nothing to cancel: done.
pub async fn cancel_before_deleting(state: &AppState, person: i64) -> Result<(), String> {
    let Some(settings) = &state.config.payments else {
        return Ok(());
    };
    let found: Option<(String, String)> =
        sqlx::query_as("SELECT subscription_id, status FROM plans WHERE person_id = ?")
            .bind(person)
            .fetch_optional(&state.db)
            .await
            .map_err(|error| error.to_string())?;
    let Some((subscription, status)) = found else {
        return Ok(());
    };
    if matches!(status.as_str(), "cancelled" | "expired" | "failed") {
        return Ok(());
    }
    let path = format!("subscriptions/{subscription}");
    let body = json!({ "status": "cancelled" });
    match ask_dodo(settings, reqwest::Method::PATCH, &path, &[], Some(&body)).await {
        Ok(_) => {
            log::info("cancelled a reader's subscription before deleting their account");
            Ok(())
        }
        // Dodo answered that it can't be cancelled (already cancelled or
        // ended, or unknown): nothing will charge, so the account can go.
        Err(DodoError {
            status: Some(400 | 404 | 409 | 410 | 422),
            detail,
        }) => {
            log::problem(&format!(
                "Dodo Payments wouldn't cancel a subscription before its account was deleted \
                 ({detail}); it is taken to be over already, but worth a look in Dodo's dashboard"
            ));
            Ok(())
        }
        Err(error) => Err(error.detail),
    }
}

/// A message from Dodo (a webhook): checked, then the reader's plan
/// updated. 200 once handled or ignored on purpose, so Dodo stops sending
/// it; 401 when the signature is wrong.
async fn message(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    let Some(settings) = &state.config.payments else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let header = |name: &str| {
        headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
    };
    let id = header("webhook-id");
    let now = now();
    if !genuine(
        &settings.webhook_key,
        id,
        header("webhook-timestamp"),
        header("webhook-signature"),
        &body,
        now,
    ) {
        log::problem("a payment message arrived without Dodo's signature, and was ignored");
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let Ok(event) = serde_json::from_slice::<Value>(&body) else {
        return (StatusCode::BAD_REQUEST, "not JSON").into_response();
    };
    let kind = event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default();
    match handle(&state, settings, id, kind, &event, now).await {
        Ok(()) => StatusCode::OK.into_response(),
        Err(error) => database_problem("keeping a payment message", &error),
    }
}

/// Whether the message is really from Dodo: a `v1` HMAC-SHA256 of
/// `id.timestamp.body` with the webhook key, sent in the last five minutes
/// (Standard Webhooks).
pub fn genuine(
    key: &[u8],
    id: &str,
    timestamp: &str,
    signatures: &str,
    body: &[u8],
    now: i64,
) -> bool {
    let Ok(sent_at) = timestamp.trim().parse::<i64>() else {
        return false;
    };
    if id.is_empty() || (now - sent_at).abs() > MESSAGE_TOLERANCE {
        return false;
    }
    signatures.split_whitespace().any(|signature| {
        let Some(given) = signature.strip_prefix("v1,").and_then(from_base64) else {
            return false;
        };
        <Hmac<sha2::Sha256> as KeyInit>::new_from_slice(key).is_ok_and(|mut mac| {
            mac.update(id.as_bytes());
            mac.update(b".");
            mac.update(timestamp.trim().as_bytes());
            mac.update(b".");
            mac.update(body);
            // Compared in constant time, so it can't be guessed bit by bit.
            mac.verify_slice(&given).is_ok()
        })
    })
}

/// Keeps what a subscription message says. Messages about anything else
/// (payments, refunds) are noted and otherwise ignored: the subscription's
/// own messages carry what matters.
async fn handle(
    state: &AppState,
    settings: &Settings,
    id: &str,
    kind: &str,
    event: &Value,
    now: i64,
) -> Result<(), sqlx::Error> {
    let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
    let fresh = sqlx::query(
        "INSERT OR IGNORE INTO payment_messages (id, type, received_at) VALUES (?, ?, ?)",
    )
    .bind(id)
    .bind(kind)
    .bind(now)
    .execute(&mut *transaction)
    .await?
    .rows_affected()
        == 1;
    sqlx::query("DELETE FROM payment_messages WHERE received_at < ?")
        .bind(now - MESSAGES_KEPT)
        .execute(&mut *transaction)
        .await?;
    if !fresh || !kind.starts_with("subscription.") {
        return transaction.commit().await;
    }
    let data = event.get("data").unwrap_or(&Value::Null);
    let text = |value: &Value, key: &str| value.get(key).and_then(Value::as_str).map(str::to_owned);
    let Some(subscription) = text(data, "subscription_id") else {
        log::problem(&format!("a payment message ({kind}) named no subscription"));
        return transaction.commit().await;
    };
    let customer = data.get("customer").unwrap_or(&Value::Null);
    let customer_id = text(customer, "customer_id").unwrap_or_default();
    let email = text(customer, "email");
    let named = data
        .get("metadata")
        .and_then(|metadata| metadata.get("person_id"))
        .and_then(|value| {
            value
                .as_str()
                .and_then(|text| text.parse().ok())
                .or_else(|| value.as_i64())
        });

    // When Dodo says this happened: a message older than the last one kept
    // for this subscription (Dodo retries late ones) changes nothing.
    let message_at = event
        .get("timestamp")
        .and_then(Value::as_str)
        .and_then(parse_rfc3339)
        .unwrap_or(now);

    // Whose: whoever already has this subscription, else the reader the
    // checkout was started for (only while their email still matches, since
    // a deleted reader's number can be given to someone new), else the
    // reader with the customer's email.
    let person: Option<i64> = sqlx::query_scalar(
        "SELECT person_id FROM plans WHERE subscription_id = ?2
         UNION ALL SELECT id FROM people
             WHERE id = ?1 AND (?3 IS NULL OR email = ?3 COLLATE NOCASE)
         UNION ALL SELECT id FROM people WHERE email = ?3 COLLATE NOCASE
         LIMIT 1",
    )
    .bind(named)
    .bind(&subscription)
    .bind(&email)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(person) = person else {
        log::problem(&format!(
            "a payment message ({kind}) is for a subscription nobody here has"
        ));
        return transaction.commit().await;
    };

    let status =
        text(data, "status").unwrap_or_else(|| kind.trim_start_matches("subscription.").to_owned());
    let renews_at = text(data, "next_billing_date").and_then(|date| parse_rfc3339(&date));
    let ending = data
        .get("cancel_at_next_billing_date")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let period = text(data, "product_id").and_then(|product| {
        if product == settings.monthly_product {
            Some("monthly".to_owned())
        } else if settings.yearly_product.as_deref() == Some(product.as_str()) {
            Some("yearly".to_owned())
        } else {
            None
        }
    });
    // The reader's plan on record, whichever subscription it is.
    let kept: Option<(String, String, i64, i64)> = sqlx::query_as(
        "SELECT subscription_id, status, access_until, message_at FROM plans WHERE person_id = ?",
    )
    .bind(person)
    .fetch_optional(&mut *transaction)
    .await?;
    let same = kept.as_ref().filter(|(id, ..)| *id == subscription);
    if same.is_some_and(|(.., at)| message_at < *at) {
        log::info(&format!("an older payment message ({kind}) was ignored"));
        return transaction.commit().await;
    }
    let earlier = same.map(|(_, status, until, _)| (status.clone(), *until));
    let access_until = access_until(&status, renews_at, earlier.as_ref(), now);
    let had_access = kept.as_ref().is_some_and(|(_, _, until, _)| *until > now);
    if let Some((other, ..)) = kept.as_ref().filter(|(id, ..)| *id != subscription) {
        if had_access && access_until <= now {
            // An old subscription ending (the reader bought again after
            // cancelling): the current one stays on record.
            log::info(&format!(
                "a message ({kind}) about a reader's earlier subscription was noted"
            ));
            return transaction.commit().await;
        }
        if had_access {
            log::problem(&format!(
                "a reader has two subscriptions at Dodo; only the newer is kept here, so the \
                 older ({other}) should be cancelled in Dodo's dashboard"
            ));
        }
    }
    sqlx::query(
        "INSERT INTO plans (person_id, subscription_id, customer_id, period, status, renews_at,
                            ending, access_until, message_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT (person_id) DO UPDATE SET
             subscription_id = excluded.subscription_id,
             customer_id = CASE WHEN excluded.customer_id = '' THEN plans.customer_id
                                ELSE excluded.customer_id END,
             period = COALESCE(excluded.period, plans.period),
             status = excluded.status, renews_at = excluded.renews_at,
             ending = excluded.ending, access_until = excluded.access_until,
             message_at = excluded.message_at, updated_at = excluded.updated_at",
    )
    .bind(person)
    .bind(&subscription)
    .bind(&customer_id)
    .bind(&period)
    .bind(&status)
    .bind(renews_at)
    .bind(i64::from(ending))
    .bind(access_until)
    .bind(message_at)
    .bind(now)
    .execute(&mut *transaction)
    .await?;
    // A plan that starts (or starts again): the reader's feeds, checked once
    // a day while it had ended, are due again soon.
    if access_until > now && !had_access {
        crate::admin::due_again(&mut transaction, person, now).await?;
    }
    transaction.commit().await?;
    log::info(&format!("a reader's plan is now {status} ({kind})"));
    Ok(())
}

/// Until when a subscription in `status` gives the reader their plan.
/// Active: to the next charge, plus `GRACE` in case a renewal message is
/// late. On hold (a renewal failed): `GRACE` from when it first went on
/// hold. Cancelled: to the end of what was paid. Ended or failed: now.
pub fn access_until(
    status: &str,
    renews_at: Option<i64>,
    earlier: Option<&(String, i64)>,
    now: i64,
) -> i64 {
    match status {
        "active" => renews_at.unwrap_or(now) + GRACE,
        "on_hold" | "past_due" => match earlier {
            Some((status, until)) if status == "on_hold" || status == "past_due" => *until,
            _ => now + GRACE,
        },
        "cancelled" => renews_at.filter(|at| *at > now).unwrap_or(now),
        // "pending" (checkout not finished), "expired", "failed", anything new.
        _ => earlier
            .filter(|_| status == "pending")
            .map_or(now, |(_, until)| *until),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_webhook_secret_starts_with_whsec() {
        assert_eq!(webhook_key("whsec_Zm9vYmFy").unwrap(), b"foobar");
        assert_eq!(webhook_key("Zm9vYmFy"), None);
        assert_eq!(webhook_key("whsec_"), None);
    }

    /// The example from the Standard Webhooks specification.
    #[test]
    fn signatures_are_checked_the_standard_webhooks_way() {
        let key = webhook_key("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw").unwrap();
        let id = "msg_p5jXN8AQM9LWM0D4loKWxJek";
        let timestamp = "1614265330";
        let body = br#"{"test": 2432232314}"#;
        let signature = "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";
        let at = 1_614_265_330;
        assert!(genuine(&key, id, timestamp, signature, body, at));
        // Several signatures, one right.
        assert!(genuine(
            &key,
            id,
            timestamp,
            &format!("v1,AAAA {signature}"),
            body,
            at
        ));
        // A changed body, an old message, another id, no signature.
        assert!(!genuine(
            &key,
            id,
            timestamp,
            signature,
            br#"{"test": 1}"#,
            at
        ));
        assert!(!genuine(&key, id, timestamp, signature, body, at + 6 * 60));
        assert!(!genuine(&key, "msg_other", timestamp, signature, body, at));
        assert!(!genuine(&key, id, timestamp, "", body, at));
    }

    #[test]
    fn a_plan_lasts_as_long_as_it_was_paid_for() {
        let now = 1_000_000_000;
        let next = now + 30 * DAY;
        assert_eq!(access_until("active", Some(next), None, now), next + GRACE);
        // A failed renewal: a week from the first failure, not from each.
        let held = ("on_hold".to_owned(), now + GRACE);
        assert_eq!(access_until("on_hold", Some(next), None, now), now + GRACE);
        assert_eq!(
            access_until("on_hold", Some(next), Some(&held), now + DAY),
            now + GRACE
        );
        assert_eq!(access_until("cancelled", Some(next), None, now), next);
        assert_eq!(access_until("cancelled", None, None, now), now);
        assert_eq!(access_until("expired", Some(next), None, now), now);
        assert_eq!(access_until("failed", None, None, now), now);
    }

    #[test]
    fn payment_settings_are_all_or_nothing_and_test_mode_unless_live() {
        let with = |pairs: Vec<(&'static str, &'static str)>| {
            move |name: &str| {
                pairs
                    .iter()
                    .find(|(key, _)| *key == name)
                    .map(|(_, value)| (*value).to_owned())
            }
        };
        assert!(settings(&with(vec![])).unwrap().is_none());
        let error = settings(&with(vec![("NINE_TURTLES_DODO_API_KEY", "k")])).unwrap_err();
        assert!(
            error.contains("NINE_TURTLES_DODO_WEBHOOK_SECRET"),
            "{error}"
        );
        let all = vec![
            ("NINE_TURTLES_DODO_API_KEY", "key"),
            ("NINE_TURTLES_DODO_WEBHOOK_SECRET", "whsec_Zm9vYmFy"),
            ("NINE_TURTLES_DODO_MONTHLY_PRODUCT", "pdt_monthly"),
        ];
        let found = settings(&with(all.clone())).unwrap().unwrap();
        assert!(!found.live);
        assert_eq!(found.api_url.as_str(), "https://test.dodopayments.com/");
        assert_eq!(found.trial_days, DEFAULT_TRIAL_DAYS);
        assert_eq!(found.monthly_price, PRICE_NOT_SET);
        assert_eq!(found.yearly_product, None);
        assert!(!format!("{found:?}").contains("key\""));

        let mut live = all.clone();
        live.push(("NINE_TURTLES_DODO_MODE", "live"));
        assert!(settings(&with(live)).unwrap().unwrap().live);
        let mut wrong_mode = all.clone();
        wrong_mode.push(("NINE_TURTLES_DODO_MODE", "real"));
        assert!(settings(&with(wrong_mode)).is_err());
        let mut bad_secret = all.clone();
        bad_secret[1] = ("NINE_TURTLES_DODO_WEBHOOK_SECRET", "secret");
        assert!(settings(&with(bad_secret)).is_err());
        let mut trial = all;
        trial.push(("NINE_TURTLES_TRIAL_DAYS", "30"));
        assert_eq!(settings(&with(trial)).unwrap().unwrap().trial_days, 30);
    }
}
