# ingest_knowledge_base.py
"""
One-time script to embed knowledge base documents into ChromaDB.
Run manually: python ingest_knowledge_base.py
Re-run this anytime you add/edit files in knowledge_base/.
"""

import os
import chromadb
from sentence_transformers import SentenceTransformer

KNOWLEDGE_BASE_DIR = "knowledge_base"
CHROMA_PERSIST_DIR = "chroma_db"
COLLECTION_NAME = "helpdesk_knowledge"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def main():
    print("=" * 60)
    print("📚 KNOWLEDGE BASE INGESTION")
    print("=" * 60)

    # ----- Load embedding model -----
    print(f"\n🔄 Loading embedding model ({EMBEDDING_MODEL})...")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print("✅ Model loaded.")

    # ----- Set up ChromaDB persistent client -----
    print(f"\n🔄 Connecting to ChromaDB (persist dir: {CHROMA_PERSIST_DIR})...")
    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

    # Delete existing collection if it exists, so re-running this script
    # doesn't create duplicate entries
    try:
        client.delete_collection(COLLECTION_NAME)
        print("   (Removed existing collection to avoid duplicates)")
    except Exception:
        pass  # Collection didn't exist yet, that's fine

    collection = client.create_collection(COLLECTION_NAME)
    print("✅ Collection ready.")

    # ----- Read and embed each document -----
    print(f"\n🔄 Reading documents from '{KNOWLEDGE_BASE_DIR}/'...")

    if not os.path.isdir(KNOWLEDGE_BASE_DIR):
        raise FileNotFoundError(
            f"Knowledge base directory '{KNOWLEDGE_BASE_DIR}' not found. "
            f"Run this script from the 'backend/' folder."
        )

    filenames = [f for f in os.listdir(KNOWLEDGE_BASE_DIR) if f.endswith(".txt")]

    if not filenames:
        raise ValueError(f"No .txt files found in '{KNOWLEDGE_BASE_DIR}/'.")

    documents = []
    ids = []
    metadatas = []

    for filename in filenames:
        filepath = os.path.join(KNOWLEDGE_BASE_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read().strip()

        doc_id = filename.replace(".txt", "")
        documents.append(content)
        ids.append(doc_id)
        metadatas.append({"source": filename})
        print(f"   📄 {filename} ({len(content)} chars)")

    # ----- Generate embeddings -----
    print(f"\n🔄 Generating embeddings for {len(documents)} documents...")
    embeddings = model.encode(documents).tolist()
    print("✅ Embeddings generated.")

    # ----- Insert into ChromaDB -----
    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )

    print(f"\n✅ Successfully ingested {len(documents)} documents into ChromaDB.")
    print(f"   Collection: '{COLLECTION_NAME}'")
    print(f"   Persisted to: '{CHROMA_PERSIST_DIR}/'")
    print("=" * 60)


if __name__ == "__main__":
    main()