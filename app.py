#this is imports and config: this pulls in flask and our custom modules while loading environment variables, and it uses python's os and dotenv libraries alongside pypdf2, and this is why we do it like this to keep api keys secure and allow server-side document parsing
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import os
import pandas as pd
import PyPDF2 

from backend.data_loader import data_manager
from backend.rag_engine import RagEngine
from backend.report_gen import ReportGenerator

load_dotenv()
os.environ['KMP_DUPLICATE_LIB_OK'] = 'True'
app = Flask(__name__)

#this is ai initialization: this creates the rag engine and report generator instances, and it passes the data manager directly to them, and this is why we do it like this so the ai has immediate access to the policies on server startup
# edge case: checking if dataframe is empty to prevent fatal crash if csv is missing
if not data_manager.policies_df.empty:
    rag_engine = RagEngine(data_manager.policies_df, data_manager.tag_columns)
else:
    print("warning: policies dataframe is empty. ai will not work.")
    rag_engine = None

report_gen = ReportGenerator(data_manager, rag_engine)

#this is route definitions: this maps web urls to python functions, and it returns json data or html templates based on the route, and this is why we do it like this so the frontend can easily fetch dynamic data asynchronously
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/graph')
def api_graph():
    return jsonify(data_manager.get_graph_data(
        request.args.get('search', ''),
        request.args.get('category', ''),
        request.args.get('type', '')
    ))

@app.route('/api/telemetry')
def api_telemetry():
    return jsonify(data_manager.get_telemetry(request.args.get('country')))

@app.route('/api/countries')
def api_countries():
    # edge case: return empty list safely if metrics data failed to load entirely
    if data_manager.metrics_df.empty:
        return jsonify([])
    countries = sorted([str(c) for c in data_manager.metrics_df['country'].unique() if pd.notnull(c)])
    return jsonify(countries)

@app.route('/api/filters')
def get_filters():
    # edge case: handle empty policy database so dropdowns show empty instead of throwing a 500 error
    if data_manager.policies_df.empty:
        return jsonify({"categories": [], "types": []})
        
    cats = sorted([str(c) for c in data_manager.policies_df['category'].unique() if pd.notnull(c)])
    types = sorted([str(t) for t in data_manager.policies_df['type'].unique() if pd.notnull(t)])
    return jsonify({"categories": cats, "types": types})

@app.route('/api/ask', methods=['POST'])
def api_ask():
    # edge case: safely return an error message if rag engine failed to initialize earlier
    if not rag_engine:
        return jsonify({"answer": "system is offline (no data).", "sources": []})
        
    query = request.json.get('query')
    answer, sources = rag_engine.ask(query)
    return jsonify({"answer": answer, "sources": sources})

@app.route('/api/generate_report', methods=['POST'])
def api_report():
    country = request.json.get('country')
    # edge case: catch missing country payload before trying to run the generator
    if not country:
        return jsonify({"error": "no country selected"}), 400
    
    report_data = report_gen.generate_brief(country)
    return jsonify(report_data)

#this is pdf upload endpoint: this receives a multipart form data file from the frontend and extracts text page by page in memory, and it passes it to the rag engine, and this is why we do it like this to avoid saving user files locally which avoids disk bloat and security risks
@app.route('/api/upload_policy', methods=['POST'])
def api_upload_policy():
    # edge case: check if the request actually contains a file object
    if 'file' not in request.files:
        return jsonify({"error": "no file uploaded"}), 400
        
    file = request.files['file']
    
    # edge case: user clicked upload without selecting anything
    if file.filename == '':
        return jsonify({"error": "no file selected"}), 400
        
    if file and file.filename.lower().endswith('.pdf'):
        try:
            reader = PyPDF2.PdfReader(file)
            pdf_text = ""
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pdf_text += text + "\n"
            
            # edge case: gracefully fail if the pdf was just images and contained no actual text
            if not pdf_text.strip():
                return jsonify({"error": "could not extract readable text from this pdf. it may be a scanned image."}), 400
            
            if rag_engine:
                analysis, sources = rag_engine.analyze_pdf(pdf_text)
                return jsonify({"answer": analysis, "sources": sources})
            else:
                return jsonify({"error": "ai engine offline"}), 500
                
        except Exception as e:
            return jsonify({"error": str(e)}), 500
            
    # edge case: strictly enforce pdf only to avoid parsing garbage data
    return jsonify({"error": "invalid file type. please upload a .pdf file."}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)