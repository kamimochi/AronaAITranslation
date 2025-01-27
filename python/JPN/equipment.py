import json
import requests

# Define the URLs for the online JSON files
jp_url = 'https://schaledb.com/data/jp/equipment.json'
kr_url = 'https://schaledb.com/data/kr/equipment.json'

# Fetch the JSON data from the URLs
jp_response = requests.get(jp_url)
kr_response = requests.get(kr_url)

# Ensure the requests were successful
jp_response.raise_for_status()
kr_response.raise_for_status()

# Load the JSON data from the response
jp_data = jp_response.json()
kr_data = kr_response.json()

# Create a dictionary to store the Korean to Traditional Chinese mapping
name_mapping = {}

# Iterate through the Korean data and match with the Traditional Chinese data using IDs
for item_id, kr_item in kr_data.items():
    jp_item = jp_data.get(item_id)  # Find the corresponding item in the Traditional Chinese data
    if jp_item:  # Ensure the item exists in both data sets
        kr_name = kr_item.get("Name")
        jp_name = jp_item.get("Name")
        if kr_name and jp_name:  # Ensure both names exist
            name_mapping[kr_name] = jp_name

# Output the result to a JSON file
output_file = 'equipment_name_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(name_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Name mapping saved to {output_file}")
