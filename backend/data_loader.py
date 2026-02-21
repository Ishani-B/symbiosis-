#this is imports and class setup: this imports pandas and the requests library for our live apis, and it sets up the data manager class, and this is why we do it like this to create a single source of truth for all data variables and external api calls
import pandas as pd
import itertools
import numpy as np
import requests
import os

class DataManager:
    def __init__(self):
        self.policies_df = pd.DataFrame()
        self.metrics_df = pd.DataFrame() 
        self.tag_columns = [
            'renewable_energy', 'carbon_pricing', 'plastic_reduction',
            'emissions_reduction', 'electric_vehicles', 'conservation',
            'circular_economy', 'clean_air', 'water_quality',
            'biodiversity_protection', 'fossil_fuel_phase_out',
            'energy_efficiency', 'sustainable_agriculture',
            'green_building', 'waste_management'
        ]
        
        # edge case: robust iso mapping dictionary for both world bank and openaq api lookups
        self.iso_map = {
            "United States": "US", "India": "IN", "China": "CN", 
            "United Kingdom": "GB", "Germany": "DE", "France": "FR",
            "Canada": "CA", "Japan": "JP", "Australia": "AU", "Brazil": "BR",
            "Denmark": "DK", "Sweden": "SE", "Norway": "NO", "Italy": "IT",
            "South Africa": "ZA", "Mexico": "MX", "South Korea": "KR"
        }
        
        self.load_data()

    #this is data loading: this reads the policies csv file into a pandas dataframe, and this is why we do it like this because policies are static text that require vectorization, unlike our telemetry which is now dynamic
    def load_data(self):
        try:
            self.policies_df = pd.read_csv('data/policies.csv')
            self.policies_df['id'] = self.policies_df['id'].astype(str)
        except FileNotFoundError:
            print("critical error: 'data/policies.csv' not found.")
            self.policies_df = pd.DataFrame(columns=['id', 'title', 'country', 'year', 'category', 'type', 'summary', 'effectiveness', 'official_url'])

    #this is graph data generation: this filters policies based on queries and builds node and edge arrays, and it maps shared tags using itertools combinations, and this is why we do it like this to dynamically format raw csv data into the exact structure vis.js expects
    def get_graph_data(self, search_query, category_filter, type_filter):
        filtered_df = self.policies_df.copy()

        if search_query:
            mask = filtered_df.astype(str).apply(
                lambda x: x.str.lower().str.contains(search_query.lower())
            ).any(axis=1)
            filtered_df = filtered_df[mask]

        if category_filter:
            filtered_df = filtered_df[filtered_df['category'] == category_filter]
        if type_filter:
            filtered_df = filtered_df[filtered_df['type'] == type_filter]

        nodes = []
        for _, row in filtered_df.iterrows():
            active_tags = [tag for tag in self.tag_columns if row.get(tag) == 'Yes']
            tags_html = "<br><br><b>tags:</b> " + ", ".join(active_tags) if active_tags else ""
            
            url = row.get('official_url')
            url_html = f"<br><br><a href='{url}' target='_blank' style='color: var(--accent); text-decoration: none; font-weight: 600;'>view official document &rarr;</a>" if pd.notna(url) else ""
            
            country_clean = str(row['country']).replace("'", "\\'")
            telemetry_btn = (
                f"<br><br><button onclick=\"window.openTelemetry('{country_clean}')\" "
                "class='btn-telemetry'>view country telemetry 📊</button>"
            )
            
            nodes.append({
                "id": str(row['id']),
                "label": str(row['title']),
                "group": str(row['category']),
                "title": f"<b>{row['title']}</b><br>{row['summary']}{tags_html}{url_html}{telemetry_btn}"
            })

        edges = []
        min_shared_tags = 2

        if not filtered_df.empty:
            for id1, id2 in itertools.combinations(filtered_df['id'], 2):
                policy1 = filtered_df[filtered_df['id'] == id1].iloc[0]
                policy2 = filtered_df[filtered_df['id'] == id2].iloc[0]
                
                shared_count = sum(1 for tag in self.tag_columns if policy1.get(tag) == 'Yes' and policy2.get(tag) == 'Yes')
                
                if shared_count >= min_shared_tags:
                    edges.append({
                        "from": str(id1),
                        "to": str(id2),
                        "value": shared_count,
                        "title": f"shared {shared_count} tags"
                    })

        return {"nodes": nodes, "edges": edges}

    #this is world bank api integration: this fetches historical indicator data spanning the last 60 years to ensure we don't miss delayed data, and it returns a dictionary mapping years to values, and this is why we do it like this to replace static csv files with authoritative global data
    def fetch_wb_indicator(self, iso_code, indicator):
        # edge case: expanded per_page to 60 because recent years (2024/2025) are often null, and asking for only 15 records cuts off usable history
        url = f"https://api.worldbank.org/v2/country/{iso_code}/indicator/{indicator}?format=json&per_page=60"
        try:
            res = requests.get(url, timeout=30)
            if res.status_code == 200:
                data = res.json()
                if len(data) > 1 and data[1]:
                    # edge case: ignore none values and convert to a dictionary sorted by year
                    valid_data = {int(item['date']): item['value'] for item in data[1] if item['value'] is not None}
                    return valid_data
        except Exception as e:
            print(f"world bank api error for {indicator}: {e}")
        return {}

    #this is live openaq integration: this fetches the absolute latest pm2.5 measurements from live sensors, and this is why we do it like this to append a true real-time snapshot to the end of our historical world bank charts
    def get_live_aqi(self, country_code):
        api_key = os.environ.get('openaq_api_key')
        if not api_key or not country_code: return None
            
        url = f"https://api.openaq.org/v2/latest?country={country_code}&parameter=pm25&limit=100"
        headers = {"X-AQ-API-Key": api_key}
        
        try:
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                results = response.json().get('results', [])
                measurements = [m.get('value') for loc in results for m in loc.get('measurements', []) if m.get('parameter') == 'pm25' and m.get('value', -1) >= 0]
                            
                if measurements:
                    return round(sum(measurements) / len(measurements), 2)
        except Exception as e:
            print(f"openaq api error: {e}")
            
        return None

    #this is telemetry alignment: this calls all apis simultaneously and stitches the disparate timelines together into a single cohesive x-axis array, and this is why we do it like this so chart.js doesn't misalign the data points
    def get_telemetry(self, country):
        country_code = self.iso_map.get(country)
        if not country_code:
            return {"metrics": {"years": [], "co2": [], "renewables": [], "aqi": []}, "events": []}
            
        c_events = self.policies_df[self.policies_df['country'] == country][['year', 'title']].to_dict('records')
        
        # edge case: updated to the modern AR5 CO2 indicator because the legacy indicator was deprecated and returns empty arrays
        wb_co2 = self.fetch_wb_indicator(country_code, "EN.GHG.CO2.PC.CE.AR5")
        wb_renew = self.fetch_wb_indicator(country_code, "EG.FEC.RNEW.ZS")
        wb_aqi = self.fetch_wb_indicator(country_code, "EN.ATM.PM25.MC.M3")
        
        all_years = list(range(2010, 2027))
        
        co2_list = [wb_co2.get(y) for y in all_years]
        renew_list = [wb_renew.get(y) for y in all_years]
        aqi_list = [wb_aqi.get(y) for y in all_years]
        
        live_aqi = self.get_live_aqi(country_code)
        if live_aqi:
            aqi_list[-1] = live_aqi 

        return {
            "metrics": {
                "years": all_years,
                "co2": co2_list,
                "renewables": renew_list,
                "aqi": aqi_list
            },
            "events": c_events
        }

data_manager = DataManager()