import json
import requests

# Define the URLs for the online JSON files
tw_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/tw/stages.json'
kr_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/kr/stages.json'

# Fetch the JSON data from the URLs
tw_response = requests.get(tw_url)
kr_response = requests.get(kr_url)

# Ensure the requests were successful
tw_response.raise_for_status()
kr_response.raise_for_status()

# Load the JSON data from the response
tw_data = tw_response.json()
kr_data = kr_response.json()

# Create dictionaries to store the "Name" fields from both files
tw_name_mapping = [item["Name"] for item in tw_data.get("Event", []) if "Name" in item]
kr_name_mapping = [item["Name"] for item in kr_data.get("Event", []) if "Name" in item]

# Generate the mapping between Korean and Traditional Chinese names based on their indices
name_mapping = {kr_name: tw_name for kr_name, tw_name in zip(kr_name_mapping, tw_name_mapping)}

# Output the result to a JSON file
output_file = 'stages_Event_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(name_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Name mapping saved to {output_file}")
