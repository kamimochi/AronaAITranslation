import json
import requests

# Define the URLs for the online JSON files
tw_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/tw/localization.json'
kr_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/kr/localization.json'

# Fetch the JSON data from the URLs
tw_response = requests.get(tw_url)
kr_response = requests.get(kr_url)

# Ensure the requests were successful
tw_response.raise_for_status()
kr_response.raise_for_status()

# Load the JSON data from the response
tw_data = tw_response.json()
kr_data = kr_response.json()

# Extract the EventName mappings from both JSON files
tw_event_names = tw_data.get("EventName", {})
kr_event_names = kr_data.get("EventName", {})

# Generate the mapping between Korean and Traditional Chinese event names
event_name_mapping = {kr_event_names[key]: tw_event_names[key] for key in kr_event_names if key in tw_event_names}

# Output the result
for kr_name, tw_name in event_name_mapping.items():
    print(f'"{kr_name}" : "{tw_name}"')
