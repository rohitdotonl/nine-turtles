//! A plain .zip file, written by hand (decision 0251): Download everything
//! (`everything`) gives the reader one file a browser can download, which
//! every computer and phone opens as a folder.
//!
//! The files are stored as they are, not compressed: what goes in is text,
//! a few megabytes at most, and a stored zip is the simplest kind there is,
//! so it needs no library and every unzip tool since 1993 reads it. Names
//! are marked as UTF-8, so titles in any script keep their letters.

use crate::dates::civil_date;

/// The most files one zip holds without the format's 64-bit extension.
pub const MOST_FILES: usize = 65_535;

/// A zip being written: each file's bytes go straight in, and the list of
/// them (the "central directory") is added by `finish`.
pub struct Zip {
    bytes: Vec<u8>,
    directory: Vec<u8>,
    files: u16,
    /// The time every file is marked with, in the format's own DOS form.
    time: u16,
    date: u16,
}

impl Zip {
    /// A new, empty zip whose files are all dated `at` (seconds, UTC).
    pub fn new(at: i64) -> Self {
        let (year, month, day) = civil_date(at);
        let seconds = at.rem_euclid(86_400);
        // DOS dates start in 1980 and count seconds in twos.
        let time = ((seconds / 3600) << 11) | ((seconds / 60 % 60) << 5) | ((seconds % 60) / 2);
        let date = ((year.clamp(1980, 2107) - 1980) << 9) | (month << 5) | day;
        Zip {
            bytes: Vec::new(),
            directory: Vec::new(),
            files: 0,
            time: u16::try_from(time).unwrap_or(0),
            date: u16::try_from(date).unwrap_or(0),
        }
    }

    /// Adds one file at `name` (folders separated by "/"). False, and
    /// nothing added, once the zip is full: past `MOST_FILES`, or past the
    /// 4 GB a plain zip can hold.
    pub fn add(&mut self, name: &str, data: &[u8]) -> bool {
        let (Ok(size), Ok(offset), Ok(name_length)) = (
            u32::try_from(data.len()),
            u32::try_from(self.bytes.len()),
            u16::try_from(name.len()),
        ) else {
            return false;
        };
        if usize::from(self.files) >= MOST_FILES
            || self.bytes.len() + data.len() + name.len() + 30 > u32::MAX as usize
        {
            return false;
        }
        let crc = crc32(data);
        // The local header, then the file itself.
        let local = &mut self.bytes;
        local.extend_from_slice(&0x0403_4b50_u32.to_le_bytes());
        local.extend_from_slice(&20_u16.to_le_bytes()); // version needed: 2.0
        common(local, self.time, self.date, crc, size, name_length);
        local.extend_from_slice(&0_u16.to_le_bytes()); // no extra field
        local.extend_from_slice(name.as_bytes());
        local.extend_from_slice(data);
        // Its line in the central directory.
        let entry = &mut self.directory;
        entry.extend_from_slice(&0x0201_4b50_u32.to_le_bytes());
        entry.extend_from_slice(&20_u16.to_le_bytes()); // made by: 2.0
        entry.extend_from_slice(&20_u16.to_le_bytes()); // version needed: 2.0
        common(entry, self.time, self.date, crc, size, name_length);
        entry.extend_from_slice(&0_u16.to_le_bytes()); // no extra field
        entry.extend_from_slice(&0_u16.to_le_bytes()); // no comment
        entry.extend_from_slice(&0_u16.to_le_bytes()); // disk 0
        entry.extend_from_slice(&0_u16.to_le_bytes()); // internal attributes
        entry.extend_from_slice(&0_u32.to_le_bytes()); // external attributes
        entry.extend_from_slice(&offset.to_le_bytes());
        entry.extend_from_slice(name.as_bytes());
        self.files += 1;
        true
    }

    /// The finished file.
    pub fn finish(mut self) -> Vec<u8> {
        let start = u32::try_from(self.bytes.len()).unwrap_or(u32::MAX);
        let size = u32::try_from(self.directory.len()).unwrap_or(u32::MAX);
        self.bytes.append(&mut self.directory);
        let end = &mut self.bytes;
        end.extend_from_slice(&0x0605_4b50_u32.to_le_bytes());
        end.extend_from_slice(&0_u16.to_le_bytes()); // this disk
        end.extend_from_slice(&0_u16.to_le_bytes()); // the directory's disk
        end.extend_from_slice(&self.files.to_le_bytes());
        end.extend_from_slice(&self.files.to_le_bytes());
        end.extend_from_slice(&size.to_le_bytes());
        end.extend_from_slice(&start.to_le_bytes());
        end.extend_from_slice(&0_u16.to_le_bytes()); // no comment
        self.bytes
    }
}

/// The part both headers share, from the flags to the name's length.
fn common(out: &mut Vec<u8>, time: u16, date: u16, crc: u32, size: u32, name_length: u16) {
    out.extend_from_slice(&0x0800_u16.to_le_bytes()); // names in UTF-8
    out.extend_from_slice(&0_u16.to_le_bytes()); // stored, not compressed
    out.extend_from_slice(&time.to_le_bytes());
    out.extend_from_slice(&date.to_le_bytes());
    out.extend_from_slice(&crc.to_le_bytes());
    out.extend_from_slice(&size.to_le_bytes()); // compressed size: the same
    out.extend_from_slice(&size.to_le_bytes());
    out.extend_from_slice(&name_length.to_le_bytes());
}

/// The CRC-32 every zip tool checks a file against (the IEEE one).
const CRC_TABLE: [u32; 256] = {
    let mut table = [0_u32; 256];
    let mut n = 0;
    while n < 256 {
        let mut c = n as u32;
        let mut k = 0;
        while k < 8 {
            c = if c & 1 == 1 {
                0xEDB8_8320 ^ (c >> 1)
            } else {
                c >> 1
            };
            k += 1;
        }
        table[n] = c;
        n += 1;
    }
    table
};

fn crc32(data: &[u8]) -> u32 {
    !data.iter().fold(!0_u32, |c, &byte| {
        CRC_TABLE[((c ^ u32::from(byte)) & 0xFF) as usize] ^ (c >> 8)
    })
}

/// Reads a zip written by `Zip` back into its files, for the tests.
pub fn files_in(zip: &[u8]) -> Vec<(String, Vec<u8>)> {
    let number = |at: usize, width: usize| {
        zip[at..at + width]
            .iter()
            .rev()
            .fold(0_usize, |n, &byte| n << 8 | usize::from(byte))
    };
    let mut files = Vec::new();
    let mut at = 0;
    while at + 30 <= zip.len() && number(at, 4) == 0x0403_4b50 {
        let size = number(at + 22, 4);
        let name_length = number(at + 26, 2);
        let name = String::from_utf8_lossy(&zip[at + 30..at + 30 + name_length]).into_owned();
        let start = at + 30 + name_length + number(at + 28, 2);
        files.push((name, zip[start..start + size].to_vec()));
        at = start + size;
    }
    files
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_checksum_is_the_standard_one() {
        assert_eq!(crc32(b""), 0);
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
    }

    #[test]
    fn files_go_in_and_come_back_out() {
        let mut zip = Zip::new(1_794_355_200); // 11 Nov 2026
        assert!(zip.add("a/index.html", b"<p>Hello</p>"));
        assert!(zip.add("a/कविता.md", "नमस्ते".as_bytes()));
        let bytes = zip.finish();
        let files = files_in(&bytes);
        assert_eq!(
            files[0],
            ("a/index.html".to_owned(), b"<p>Hello</p>".to_vec())
        );
        assert_eq!(files[1].0, "a/कविता.md");
        // The end record names two files and where the directory starts.
        let end = &bytes[bytes.len() - 22..];
        assert_eq!(&end[..4], &0x0605_4b50_u32.to_le_bytes());
        assert_eq!(u16::from_le_bytes([end[10], end[11]]), 2);
        // The date is written as the format counts it: 2026 is 46 years after 1980.
        assert_eq!(u16::from_le_bytes([bytes[12], bytes[13]]) >> 9, 46);
    }
}
