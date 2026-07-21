"""
Runtime service for querying ChromaDB.
Used by the API to search knowledge base during email processing.
Matches the configuration from ingest_knowledge_base.py.
"""

import chromadb
from sentence_transformers import SentenceTransformer
from typing import List, Dict

# Same constants as ingest_knowledge_base.py
CHROMA_PERSIST_DIR = "chroma_db"
COLLECTION_NAME = "helpdesk_knowledge"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


class KnowledgeService:
    """Runtime service for querying ChromaDB."""
    
    def __init__(self):
        print("🔍 Initializing Knowledge Service...")
        
        # Load the same embedding model
        self.model = SentenceTransformer(EMBEDDING_MODEL)
        print("✅ Embedding model loaded.")
        
        # Connect to existing ChromaDB
        self.client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        
        # Get the existing collection (don't create or delete)
        try:
            self.collection = self.client.get_collection(COLLECTION_NAME)
            print(f"✅ Connected to collection: '{COLLECTION_NAME}'")
        except Exception as e:
            print(f"⚠️ Collection not found: {e}")
            print(f"   Run 'python ingest_knowledge_base.py' first.")
            self.collection = None
    
    def search(self, query: str, top_k: int = 3) -> List[Dict]:
        """Search for relevant documents matching the query."""
        if not self.collection:
            return []
        
        try:
            # Generate embedding for the query using the same model
            query_embedding = self.model.encode(query).tolist()
            
            # Query ChromaDB
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k
            )
            
            formatted_results = []
            for i in range(len(results['ids'][0])):
                formatted_results.append({
                    "document": results['metadatas'][0][i].get('source', 'Unknown'),
                    "snippet": results['documents'][0][i][:300],
                    "score": results['distances'][0][i] if 'distances' in results else 0.0
                })
            return formatted_results
        except Exception as e:
            print(f"⚠️ Search failed: {e}")
            return []


# Singleton instance
knowledge_service = KnowledgeService()


# ----- Optional: Test function -----
def test_search(query: str = "I forgot my password", top_k: int = 3):
    """Test the search functionality."""
    print("\n" + "=" * 60)
    print("🔍 TESTING KNOWLEDGE SEARCH")
    print("=" * 60)
    print(f"\nQuery: '{query}'")
    
    results = knowledge_service.search(query, top_k)
    
    if not results:
        print("\n⚠️ No results found.")
        return
    
    print(f"\n📚 Found {len(results)} results:")
    for i, result in enumerate(results, 1):
        print(f"\n{i}. Document: {result['document']}")
        print(f"   Score: {result['score']:.4f}")
        print(f"   Snippet: {result['snippet'][:150]}...")


if __name__ == "__main__":
    test_search()