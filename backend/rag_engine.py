#this is imports and class setup: this imports langchain tools and openai embeddings, and it initializes the greenpt models, and this is why we do it like this to bundle all complex ai logic into one clean, reusable object
import os
from langchain_community.vectorstores import FAISS
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document

class RagEngine:
    def __init__(self, data_frame, tags):
        self.api_key = os.environ.get("greenpt_api_key")
        self.base_url = "https://api.greenpt.ai/v1"
        
        self.llm = ChatOpenAI(
            model="green-r-raw", 
            api_key=self.api_key, 
            base_url=self.base_url,
            temperature=0
        )
        
        self.embeddings = OpenAIEmbeddings(
            model="green-embeddings", 
            api_key=self.api_key, 
            base_url=self.base_url
        )
        
        self.retriever = self._build_vector_store(data_frame, tags)
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", "you are an expert environmental policy analyst. use the provided context to answer. context: {context}"),
            ("human", "{input}"),
        ])

    #this is database creation: this iterates through policies and bundles them into text documents for the ai to read, and it creates a faiss index, and this is why we do it like this to allow the ai to rapidly search thousands of policies using vector similarity
    def _build_vector_store(self, df, tags):
        print("building greenpt vector database...")
        documents = []
        
        for _, row in df.iterrows():
            active_tags = [tag for tag in tags if row.get(tag) == 'Yes']
            
            content = (
                f"policy title: {row['title']}\n"
                f"location: {row.get('region', '')}, {row['country']} ({row['year']})\n"
                f"category: {row['category']} | type: {row['type']}\n"
                f"summary: {row['summary']}\n"
                f"tags: {', '.join(active_tags)}\n"
                f"effectiveness score: {row['effectiveness']}/100"
            )
            
            documents.append(Document(page_content=content, metadata={"id": row['id']}))

        # edge case: only try to run faiss if documents array actually has items in it
        if documents:
            vector_store = FAISS.from_documents(documents, self.embeddings)
            return vector_store.as_retriever(search_kwargs={"k": 15})
        else:
            print("warning: no documents found. ai will not have context.")
            return None

    #this is ai query execution: this runs a user search against the faiss database to find context, and it passes both the context and query to the llm, and this is why we do it like this to prevent ai hallucinations by grounding answers in our own csv data
    def ask(self, query):
        # edge case: fallback string if the database never built successfully
        if not self.retriever:
            return "i have no data to answer that.", []
        docs = self.retriever.invoke(query)
        sources = [d.metadata['id'] for d in docs]
        context = "\n\n".join([d.page_content for d in docs])
        
        response = self.llm.invoke(self.prompt.format_messages(context=context, input=query))
        
        return str(response.content), sources

    #this is pdf policy analysis: this takes raw text from an uploaded document and searches the vector database for similar historical laws, and it formats a strict comparison prompt, and this is why we do it like this to turn static data into an active policy workshopping tool
    def analyze_pdf(self, pdf_text):
        # edge case: abort if database is offline
        if not self.retriever:
            return "system offline.", []
            
        # edge case: grab only the first 2000 characters for the search query to avoid blowing up the embedding token limit
        search_query = "find environmental policies similar to these mechanisms: " + pdf_text[:2000]
        
        docs = self.retriever.invoke(search_query)
        sources = [d.metadata['id'] for d in docs]
        context = "\n\n".join([d.page_content for d in docs])
        
        prompt_template = (
            "you are an expert policy analyst. i am providing you with the text of a draft policy "
            "and a context of existing global environmental policies.\n\n"
            "draft policy text:\n{pdf_text}\n\n"
            "existing policies context:\n{context}\n\n"
            "please provide exactly this format:\n"
            "### 📄 document summary\n"
            "a 3-bullet summary of the draft policy.\n\n"
            "### 🔍 similarity match\n"
            "a comparison identifying the closest existing policy from the context and explaining why they overlap.\n\n"
            "### 💡 actionable recommendations\n"
            "recommendations on how to improve the draft based on the historical successes or failures of the matched policy."
        )
        
        # edge case: truncate full pdf text to 4000 characters to ensure the llm context window doesn't overflow
        safe_pdf_text = pdf_text[:4000]
        
        response = self.llm.invoke(self.prompt.format_messages(
            context=context, 
            input=prompt_template.format(pdf_text=safe_pdf_text, context=context)
        ))
        
        return str(response.content), sources