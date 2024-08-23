// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::api::dialog::message;

fn get_app_data_dir() -> String {
    // Get the location next to the executable itself
    let exe_path = std::env::current_exe().unwrap();
    let app_data_dir = exe_path
        .parent()?
        .to_string();
    return app_data_dir;
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_root_path() -> String {
    return get_app_data_dir();
}

#[tauri::command]
fn confirm_overwrite(msg: &str) -> bool {
    let res = message(
        "Files Already Exist",
        msg,
    )
    .ok()
    .unwrap();

    return res;
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            let window = WindowBuilder::new(
                app,
                "main",
                WindowUrl::App("index.html".into()),
            )
            .title("Sonic: Lock & Load")
            .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
