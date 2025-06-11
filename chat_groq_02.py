import os
import requests

api_key = os.getenv("groq_key")
if not api_key:
    raise Exception("La variable de entorno groq_key no está definida")

url = "https://api.groq.com/openai/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}

data = {
    "model": "llama3-70b-8192",
    "messages": [
        {
        "role": "user", 
        "content": "Dame una diferencia y una similitud entre Victor Hugo y Shakespeare"}
    ],
}

response = requests.post(url, headers=headers, json=data)
print(response.json()["choices"][0]["message"]["content"])