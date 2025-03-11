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

# Create a dictionary to store the description mappings
desc_mapping = {}

# Iterate through the Korean data and match descriptions with Traditional Chinese data using IDs
for item_id, kr_item in kr_data.items():
    jp_item = jp_data.get(item_id)  # Find the corresponding item in the Traditional Chinese data
    if jp_item:  # Ensure the item exists in both datasets
        kr_desc = kr_item.get("Desc")
        jp_desc = jp_item.get("Desc")
        if kr_desc and jp_desc:  # Ensure both descriptions exist
            desc_mapping[kr_desc] = jp_desc

# Output the result to a JSON file
output_file = 'equipment_Desc_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(desc_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Description mapping saved to {output_file}")
