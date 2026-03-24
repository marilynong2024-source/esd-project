import requests

TRAVELLER_PROFILE_BASE_URL = "https://personal-zhhppbon.outsystemscloud.com/TravellerProfileService/rest/TravellerProfileAPI"

def get_profiles_by_account(customer_id):
    response = requests.get(f"{TRAVELLER_PROFILE_BASE_URL}/byaccount/{customer_id}")
    if response.status_code == 200:
        return response.json()
    return None

def get_traveller_profile(traveller_profile_id):
    response = requests.get(f"{TRAVELLER_PROFILE_BASE_URL}/{traveller_profile_id}")
    if response.status_code == 200:
        return response.json()
    return None

def create_traveller_profile(data):
    response = requests.post(
        f"{TRAVELLER_PROFILE_BASE_URL}/CreateTravellerProfile",
        json=data,
        headers={"Content-Type": "application/json"}
    )
    if response.status_code == 200:
        return response.json()
    return None

def update_traveller_profile(traveller_profile_id, data):
    response = requests.put(
        f"{TRAVELLER_PROFILE_BASE_URL}/UpdateTravellerProfile/{traveller_profile_id}",
        json=data,
        headers={"Content-Type": "application/json"}
    )
    if response.status_code == 200:
        return response.json()
    return None

def delete_traveller_profile(traveller_profile_id):
    response = requests.delete(
        f"{TRAVELLER_PROFILE_BASE_URL}/DeleteTravellerProfile/{traveller_profile_id}"
    )
    if response.status_code == 200:
        return response.json()
    return None