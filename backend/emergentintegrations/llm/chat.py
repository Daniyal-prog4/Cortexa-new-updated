class TextDelta:
    def __init__(self, content):
        self.content = content

class UserMessage:
    def __init__(self, text):
        self.text = text

class LlmChat:
    def __init__(self, api_key=None, session_id=None, system_message=None):
        pass
    def with_model(self, provider, model_name):
        return self
    async def send_message(self, message):
        return "Hello! I am your local simulated Cortexa assistant."
    async def stream_message(self, message):
        yield TextDelta("Hello! ")
        yield TextDelta("I am your local simulated Cortexa AI assistant running successfully.")