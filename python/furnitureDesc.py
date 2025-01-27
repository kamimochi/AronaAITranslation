import json
import requests

# Define the URLs for the online JSON files
tw_url = 'https://schaledb.com/data/tw/furniture.json'
kr_url = 'https://schaledb.com/data/kr/furniture.json'

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
tw_name_mapping = {item["Id"]: item["Desc"] for item in tw_data if "Desc" in item}
kr_name_mapping = {item["Id"]: item["Desc"] for item in kr_data if "Desc" in item}

# Generate the mapping between Korean and Traditional Chinese names based on "Id"
name_mapping = {kr_name_mapping[key]: tw_name_mapping[key] for key in kr_name_mapping if key in tw_name_mapping}

# Output the result to a JSON file
output_file = 'furniture_Desc_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(name_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Name mapping saved to {output_file}")
