import subprocess
import sys
import time
import os
import signal

def main():
    print("=========================================================")
    print("  ALPHATRADER SYSTEM STARTUP")
    print("  FastAPI Backend (yfinance) + React Frontend (Vite)")
    print("=========================================================")
    
    # Check if frontend is built or packages are ready
    if not os.path.exists("frontend/node_modules"):
        print("Error: Frontend dependencies are not installed. Run 'npm install' in frontend first.")
        sys.exit(1)
        
    processes = []
    
    try:
        # 1. Start the FastAPI Backend
        # Since uvicorn is installed in the python environment, we run main.py
        backend_cmd = [sys.executable, "backend/main.py"]
        print(f"[*] Launching FastAPI Backend on http://127.0.0.1:8000...")
        backend_proc = subprocess.Popen(
            backend_cmd,
            # We let output go directly to stdout/stderr of parent process
            stdout=None,
            stderr=None
        )
        processes.append(backend_proc)
        
        # Give backend a moment to bind to port 8000
        time.sleep(2)
        
        # Retrieve LAN IP address to print instructions for mobile devices
        import socket
        def get_local_ip():
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                ip = s.getsockname()[0]
                s.close()
                return ip
            except Exception:
                return "127.0.0.1"
        local_ip = get_local_ip()
        
        # 2. Start the Vite React Frontend
        print(f"[*] Launching Vite React Dev Server on network port...")
        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd="frontend",
            shell=True,
            stdout=None,
            stderr=None
        )
        processes.append(frontend_proc)
        
        # 3. Automatically open default web browser
        time.sleep(1.5)
        try:
            import webbrowser
            print("[*] Opening default web browser to http://localhost:5173...")
            webbrowser.open("http://localhost:5173")
        except Exception as wb_err:
            print(f"[!] Warning: Could not automatically open browser: {wb_err}")
        
        print("\n[+] Both servers are running successfully!")
        print(f"    - Local Access:  http://localhost:5173")
        if local_ip != "127.0.0.1":
            print(f"    - Mobile/LAN:    http://{local_ip}:5173  (Ensure phone is on the same Wi-Fi)")
            print(f"    - Backend API:   http://{local_ip}:8000")
        else:
            print(f"    - Backend API:   http://localhost:8000")
        print("[*] Press Ctrl+C in this console to stop both servers safely.\n")
        
        # Monitor the processes
        while True:
            # Check if backend or frontend terminated
            if backend_proc.poll() is not None:
                print("[-] Backend process terminated unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("[-] Frontend process terminated unexpectedly.")
                break
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[!] Ctrl+C detected. Shutting down servers...")
    except Exception as e:
        print(f"\n[!] Error starting servers: {e}")
    finally:
        # Clean shutdown of both processes
        for p in processes:
            if p.poll() is None:
                print(f"[*] Terminating process {p.pid}...")
                try:
                    # On windows, taskkill or standard terminate
                    p.terminate()
                    p.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    print(f"[!] Process {p.pid} did not terminate, killing...")
                    p.kill()
                except Exception as ex:
                    print(f"Error terminating process: {ex}")
                    
        print("[+] All servers stopped. Goodbye.")

if __name__ == "__main__":
    main()
