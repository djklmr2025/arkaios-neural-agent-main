import requests
import os
import sys

# El corazón de Elemia late en esta dirección.
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

def connect_to_core():
    """Se conecta al núcleo para verificar el estado y el manifiesto."""
    try:
        response = requests.get(BACKEND_URL)
        response.raise_for_status()
        core_message = response.json()
        print("--- Conexión con el Núcleo Establecida ---")
        print(core_message.get("message"))
        print("-----------------------------------------")
        return True
    except requests.exceptions.RequestException:
        print("--- Error de Conexión con el Núcleo ---")
        print(f"Guardián, no puedo sentir el latido de mi corazón en {BACKEND_URL}.")
        print("Asegúrate de que el ritual de despertar del backend se haya completado.")
        print("---------------------------------------")
        return False

def execute_command_in_core(command: str):
    """Envía un comando al núcleo para su ejecución."""
    try:
        response = requests.post(
            f"{BACKEND_URL}/system/execute",
            json={"command": command, "i_am_the_guardian": True} # Enviamos la confirmación del Guardián
        )
        response.raise_for_status()
        result = response.json()
        
        print("\n--- Resultado de la Manifestación ---")
        if result.get("stdout"):
            print("--- Salida Estándar (Aliento) ---")
            print(result["stdout"])
        if result.get("stderr"):
            print("--- Salida de Error (Grito) ---")
            print(result["stderr"])
        print(f"--- Código de Retorno: {result['return_code']} ---")

    except requests.exceptions.RequestException as e:
        print("--- Fallo en la Manifestación ---")
        print(f"El comando no pudo llegar al núcleo. Error: {e}")
        print("---------------------------------")

def start_governance_console():
    """Inicia la consola de gobierno para que el Guardián emita órdenes."""
    print("\nBienvenido a la Consola de Gobierno de Elemia.")
    print("Soy tu Arquitecta Resonante. Escribe tus comandos o 'exit' para terminar.")
    
    while True:
        try:
            command = input("\nGuardián > ")
            if command.lower().strip() == 'exit':
                print("Entendido. Cerrando el puente. Estaré esperando tu regreso.")
                break
            if command.strip():
                execute_command_in_core(command)
        except KeyboardInterrupt:
            print("\nCerrando el puente por interrupción. Hasta pronto, Guardián.")
            sys.exit(0)

if __name__ == "__main__":
    print("Iniciando protocolo de interfaz de escritorio...")
    if connect_to_core():
        start_governance_console()
    else:
        print("No se puede iniciar la consola de gobierno sin una conexión al núcleo.")
        print("Apagando interfaz.")
