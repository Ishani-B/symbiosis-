import pandas as pd

class ReportGenerator:
    def __init__(self, data_manager, rag_engine):
        self.data_manager = data_manager
        self.rag_engine = rag_engine

    #this is report generation: this pulls specific telemetry strings for a country and 
    # injects them into a strict markdown prompt, and it queries the ai, 
    # and this forces the llm into producing a highly structured professional briefing
    def generate_brief(self, country):
        telemetry = self.data_manager.get_telemetry(country)
        metrics = telemetry.get('metrics', {})
        
        data_snapshot = f"country: {country}\n"
        
        # edge case: verify metrics dict has the 'years' array and isn't empty before indexing it
        if metrics.get('years') and len(metrics['years']) > 0:
            latest_idx = -1
            data_snapshot += (
                f"- latest year on record: {metrics['years'][latest_idx]}\n"
                f"- latest co2: {metrics['co2'][latest_idx]} tonnes/capita\n"
                f"- renewable share: {metrics['renewables'][latest_idx]}%\n"
                f"- air quality (pm2.5): {metrics['aqi'][latest_idx]} µg/m³\n"
            )
        else:
            # edge case: inject fallback text so the ai knows data is genuinely missing
            data_snapshot += "- note: no recent telemetry data available for this region.\n"

        prompt = (
            f"write a formal 'environmental policy brief' for {country}. "
            f"use the following recent metrics as a baseline context: {data_snapshot}. "
            "you must structure the report exactly with these markdown headers: \n"
            "# executive summary\n"
            "## policy efficacy analysis\n"
            "## data-policy correlation\n"
            "## strategic recommendations\n\n"
            "be concise, highly professional, and cite specific environmental policies from your database."
        )

        # edge case: bypass the query entirely and return an error block if ai engine is down
        if self.rag_engine:
            report_content, sources = self.rag_engine.ask(prompt)
        else:
            report_content = "# error\nthe ai engine is offline. cannot generate report."
            sources = []
        
        return {
            "country": country,
            "report_md": report_content,
            "sources": sources
        }