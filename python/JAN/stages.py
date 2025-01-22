import json
import requests

# Define the URLs for the online JSON files
jp_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/jp/stages.json'
kr_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/kr/stages.json'

# Fetch the JSON data from the URLs
jp_response = requests.get(jp_url)
kr_response = requests.get(kr_url)

# Ensure the requests were successful
jp_response.raise_for_status()
kr_response.raise_for_status()

# Load the JSON data from the response
jp_data = jp_response.json()
kr_data = kr_response.json()

# Create dictionaries to store the "Name" fields from both files
jp_name_mapping = [item["Name"] for item in jp_data.get("Campaign", []) if "Name" in item]
kr_name_mapping = [item["Name"] for item in kr_data.get("Campaign", []) if "Name" in item]

# Generate the mapping bejpeen Korean and Traditional Chinese names based on their indices
name_mapping = {kr_name: jp_name for kr_name, jp_name in zip(kr_name_mapping, jp_name_mapping)}

# Output the result to a JSON file
output_file = 'stages_name_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(name_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Name mapping saved to {output_file}")
