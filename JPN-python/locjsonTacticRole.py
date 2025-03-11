import json
import requests

# Define the URLs for the online JSON files
jp_url = 'https://schaledb.com/data/jp/localization.json'
kr_url = 'https://schaledb.com/data/kr/localization.json'

# Fetch the JSON data from the URLs
jp_response = requests.get(jp_url)
kr_response = requests.get(kr_url)

# Ensure the requests were successful
jp_response.raise_for_status()
kr_response.raise_for_status()

# Load the JSON data from the response
jp_data = jp_response.json()
kr_data = kr_response.json()

# Extract the EventName mappings from both JSON files
jp_TacticRole_names = jp_data.get("TacticRole", {})
kr_TacticRole_names = kr_data.get("TacticRole", {})

# Generate the mapping bejpeen Korean and Traditional Chinese event names
event_name_mapping = {kr_TacticRole_names[key]: jp_TacticRole_names[key] for key in kr_TacticRole_names if key in jp_TacticRole_names}

# Output the result to a JSON file
output_file = 'TacticRole.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(event_name_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Event name mapping saved to {output_file}")
