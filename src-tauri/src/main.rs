// Cortexa Tauri desktop entry — bridges local system telemetry & tool execution to the React UI.
// This is the MVP scaffold; permission engine & tool registry live here in a future phase.

use serde::Serialize;
use sysinfo::{CpuExt, DiskExt, System, SystemExt};

#[derive(Serialize)]
struct Telemetry {
    cpu: u8,
    ram: u8,
    disk: u8,
    battery: u8,
    online: bool,
}

#[tauri::command]
fn telemetry() -> Telemetry {
    let mut sys = System::new_all();
    sys.refresh_all();

    // CPU average
    let cpu = if sys.cpus().is_empty() {
        0
    } else {
        (sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>() / sys.cpus().len() as f32) as u8
    };

    // RAM
    let ram = if sys.total_memory() > 0 {
        ((sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0) as u8
    } else {
        0
    };

    // Disk (first drive)
    let disk = sys
        .disks()
        .first()
        .map(|d| {
            if d.total_space() > 0 {
                (((d.total_space() - d.available_space()) as f64 / d.total_space() as f64) * 100.0) as u8
            } else {
                0
            }
        })
        .unwrap_or(0);

    Telemetry {
        cpu,
        ram,
        disk,
        battery: 84, // TODO: wire battery via `battery` crate
        online: true,
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![telemetry])
        .run(tauri::generate_context!())
        .expect("error while running Cortexa");
}
