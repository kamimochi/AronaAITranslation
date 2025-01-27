import json
import requests

# Define the URLs for the online JSON files
tw_url = 'https://schaledb.com/data/tw/equipment.json'
kr_url = 'https://schaledb.com/data/kr/equipment.json'

# Fetch the JSON data from the URLs
tw_response = requests.get(tw_url)
kr_response = requests.get(kr_url)

# Ensure the requests were successful
tw_response.raise_for_status()
kr_response.raise_for_status()

# Load the JSON data from the response
tw_data = tw_response.json()
kr_data = kr_response.json()

# Create a dictionary to store the description mappings
desc_mapping = {}

# Iterate through the Korean data and match descriptions with Traditional Chinese data using IDs
for item_id, kr_item in kr_data.items():
    tw_item = tw_data.get(item_id)  # Find the corresponding item in the Traditional Chinese data
    if tw_item:  # Ensure the item exists in both datasets
        kr_desc = kr_item.get("Desc")
        tw_desc = tw_item.get("Desc")
        if kr_desc and tw_desc:  # Ensure both descriptions exist
            desc_mapping[kr_desc] = tw_desc

# Output the result to a JSON file
output_file = 'equipment_Desc_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(desc_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Description mapping saved to {output_file}")
