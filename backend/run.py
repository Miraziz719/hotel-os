import subprocess
import sys
import time


SERVICES = [
    ("reception", "backend.app.service_apps:reception_app", 8001),
    ("housekeeping", "backend.app.service_apps:housekeeping_app", 8002),
    ("room_service", "backend.app.service_apps:room_service_app", 8003),
    ("maintenance", "backend.app.service_apps:maintenance_app", 8004),
]


def start_service(app_path: str, port: int) -> subprocess.Popen:
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            app_path,
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--reload",
        ]
    )


if __name__ == "__main__":
    processes = [start_service(app_path, port) for _, app_path, port in SERVICES]
    print("Started services:")
    for name, _, port in SERVICES:
        print(f" - {name}: http://127.0.0.1:{port}")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping services...")
        for proc in processes:
            proc.terminate()
        for proc in processes:
            proc.wait()
