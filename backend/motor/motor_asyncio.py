# Mock Motor AsyncIO Module
class MockCursor:
    def __init__(self, data):
        self._data = data
    def sort(self, *args, **kwargs):
        return self
    def limit(self, n):
        self._data = self._data[:n]
        return self
    async def to_list(self, length):
        return self._data[:length]

class MockCollection:
    def __init__(self):
        self.documents = []
    async def find_one(self, query, projection=None):
        for doc in self.documents:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                return dict(doc)
        return None
    def find(self, query=None, projection=None):
        results = []
        for doc in self.documents:
            match = True
            if query:
                for k, v in query.items():
                    if doc.get(k) != v:
                        match = False
                        break
            if match:
                results.append(dict(doc))
        return MockCursor(results)
    async def insert_one(self, doc):
        self.documents.append(dict(doc))
        return True
    async def insert_many(self, docs):
        for d in docs:
            self.documents.append(dict(d))
        return True
    async def update_one(self, query, update, upsert=False):
        doc = await self.find_one(query)
        if doc:
            if "$set" in update:
                for k, v in update["$set"].items():
                    doc[k] = v
            for i, d in enumerate(self.documents):
                if d.get("id") == doc.get("id") or (d.get("email") and d.get("email") == doc.get("email")):
                    self.documents[i] = doc
                    break
        elif upsert:
            new_doc = dict(query)
            if "$set" in update:
                new_doc.update(update["$set"])
            self.documents.append(new_doc)
        return type('obj', (object,), {'matched_count': 1 if doc or upsert else 0, 'deleted_count': 0})()
    async def delete_one(self, query):
        doc = await self.find_one(query)
        if doc:
            self.documents = [d for d in self.documents if d != doc]
            return type('obj', (object,), {'deleted_count': 1})()
        return type('obj', (object,), {'deleted_count': 0})()
    async def create_index(self, *args, **kwargs):
        pass

class MockDB:
    def __init__(self):
        self.users = MockCollection()
        self.devices = MockCollection()
        self.agents = MockCollection()
        self.memory = MockCollection()
        self.tasks = MockCollection()
        self.activity = MockCollection()
        self.chat_messages = MockCollection()
        self.tool_requests = MockCollection()
        self.login_attempts = MockCollection()
    def __getattr__(self, name):
        if name not in self.__dict__:
            setattr(self, name, MockCollection())
        return self.__dict__[name]

class AsyncIOMotorClient:
    def __init__(self, *args, **kwargs):
        pass
    def __getitem__(self, name):
        return MockDB()