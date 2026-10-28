//! Calendar dates and RFC 3339 times, for seconds since 1970 (UTC), the way
//! nine turtles stores times. Howard Hinnant's well-known date method, once.

/// The calendar date (year, month, day) for seconds since 1970 ("civil_from_days").
pub fn civil_date(at: i64) -> (i64, i64, i64) {
    let days = at.div_euclid(86_400) + 719_468;
    let era = days.div_euclid(146_097);
    let day_of_era = days - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

/// Days since 1970 for a calendar date ("days_from_civil"), the reverse of `civil_date`.
pub fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = year.div_euclid(400);
    let year_of_era = year.rem_euclid(400);
    let shifted_month = if month > 2 { month - 3 } else { month + 9 };
    let day_of_year = (153 * shifted_month + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

/// A time as RFC 3339 writes it, in UTC: `2026-10-23T20:18:35Z`.
pub fn rfc3339(at: i64) -> String {
    let (year, month, day) = civil_date(at);
    let seconds = at.rem_euclid(86_400);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        seconds / 3_600,
        seconds % 3_600 / 60,
        seconds % 60
    )
}

/// Reads `2026-10-23T20:18:35Z` (or with a fraction of a second, a space for
/// the `T`, or an offset such as `+05:30`), or a date alone (`2026-10-23`,
/// midnight UTC), as seconds since 1970.
pub fn parse_rfc3339(text: &str) -> Option<i64> {
    let text = text.trim();
    let number = |range: std::ops::Range<usize>| -> Option<i64> {
        let part = text.get(range)?;
        part.bytes()
            .all(|byte| byte.is_ascii_digit())
            .then(|| part.parse().ok())?
    };
    let separators = text.as_bytes();
    let (year, month, day) = (number(0..4)?, number(5..7)?, number(8..10)?);
    if separators.get(4) != Some(&b'-')
        || separators.get(7) != Some(&b'-')
        || !(1..=12).contains(&month)
        || !(1..=31).contains(&day)
    {
        return None;
    }
    let days = days_from_civil(year, month, day);
    if text.len() == 10 {
        return Some(days * 86_400);
    }
    let (hour, minute, second) = (number(11..13)?, number(14..16)?, number(17..19)?);
    if !matches!(separators.get(10), Some(b'T' | b't' | b' '))
        || separators.get(13) != Some(&b':')
        || separators.get(16) != Some(&b':')
        || hour > 23
        || minute > 59
        || second > 60
    {
        return None;
    }
    let rest = text[19..].trim_start_matches(|c: char| c == '.' || c.is_ascii_digit());
    let offset = match rest.as_bytes().first() {
        None | Some(b'Z' | b'z') => 0,
        Some(sign @ (b'+' | b'-')) => {
            let hours: i64 = rest.get(1..3)?.parse().ok()?;
            // `+05:30`, `+0530` or `+05`.
            let minutes = if rest.get(3..4) == Some(":") {
                4..6
            } else {
                3..5
            };
            let minutes: i64 = rest.get(minutes).map_or(Some(0), |m| m.parse().ok())?;
            let offset = hours * 3_600 + minutes * 60;
            if *sign == b'+' { offset } else { -offset }
        }
        _ => return None,
    };
    Some(days * 86_400 + hour * 3_600 + minute * 60 + second - offset)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates_go_both_ways() {
        assert_eq!(civil_date(0), (1970, 1, 1));
        assert_eq!(civil_date(951_782_400), (2000, 2, 29));
        assert_eq!(civil_date(-1), (1969, 12, 31));
        for days in [-800_000, -1, 0, 59, 60, 11_016, 20_000, 2_932_896] {
            let (year, month, day) = civil_date(days * 86_400);
            assert_eq!(days_from_civil(year, month, day), days);
        }
    }

    #[test]
    fn times_are_written() {
        assert_eq!(rfc3339(0), "1970-01-01T00:00:00Z");
        assert_eq!(rfc3339(1_792_786_715), "2026-10-23T20:18:35Z");
        assert_eq!(rfc3339(-1), "1969-12-31T23:59:59Z");
    }

    #[test]
    fn times_are_read() {
        assert_eq!(parse_rfc3339("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(parse_rfc3339("2026-10-23T20:18:35Z"), Some(1_792_786_715));
        assert_eq!(
            parse_rfc3339("2026-10-23T20:18:35.123456Z"),
            Some(1_792_786_715)
        );
        assert_eq!(
            parse_rfc3339("2026-10-24T01:48:35+05:30"),
            Some(1_792_786_715)
        );
        assert_eq!(
            parse_rfc3339("2026-10-24T01:48:35+0530"),
            Some(1_792_786_715)
        );
        assert_eq!(parse_rfc3339("2026-10-23T15:18:35-05"), Some(1_792_786_715));
        assert_eq!(parse_rfc3339(" 2026-10-23t20:18:35z "), Some(1_792_786_715));
        assert_eq!(parse_rfc3339("2000-02-29 00:00:00"), Some(951_782_400));
        assert_eq!(parse_rfc3339("2000-02-29"), Some(951_782_400));
        assert_eq!(parse_rfc3339("1969-12-31T23:59:59Z"), Some(-1));
        assert_eq!(parse_rfc3339(&rfc3339(1_792_786_715)), Some(1_792_786_715));
        for wrong in [
            "yesterday",
            "soon",
            "",
            "2026-13-01T00:00:00Z",
            "2026-10-32",
            "2026/10/23",
            "2026-10-23T25:00:00Z",
            "2026-10-23T20:18",
            "2026-10-23T20:18:35 GMT",
            "+026-10-23",
        ] {
            assert_eq!(parse_rfc3339(wrong), None, "{wrong}");
        }
    }
}
