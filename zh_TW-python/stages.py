import json
import requests

# Define the URLs for the online JSON files
tw_url = 'https://schaledb.com/data/tw/stages.json'
kr_url = 'https://schaledb.com/data/kr/stages.json'

# Fetch the JSON data from the URLs
tw_response = requests.get(tw_url)
kr_response = requests.get(kr_url)

# Ensure the requests were successful
tw_response.raise_for_status()
kr_response.raise_for_status()

# Load the JSON data from the response
tw_data = tw_response.json()
kr_data = kr_response.json()

# Create a dictionary to store the mapping
name_mapping = {}

# Iterate through the Korean data and match with Traditional Chinese data using IDs
for stage_id, kr_stage in kr_data.items():
    tw_stage = tw_data.get(stage_id)  # Find the corresponding stage in the Traditional Chinese data
    if tw_stage:  # Ensure the stage exists in both datasets
        kr_name = kr_stage.get("Name")
        tw_name = tw_stage.get("Name")
        if kr_name and tw_name:  # Ensure both names exist
            name_mapping[kr_name] = tw_name

# Output the result to a JSON file
output_file = 'stages_name_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(name_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Name mapping saved to {output_file}")
