import os
import sys
import io
import json
import re


def get_credentials():
    creds_json = os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON', '')
    if not creds_json:
        creds_file = os.environ.get('GOOGLE_SERVICE_ACCOUNT_FILE', '')
        if creds_file and os.path.exists(creds_file):
            with open(creds_file, 'r') as f:
                return json.load(f)
        print('ERROR: GOOGLE_SERVICE_ACCOUNT_JSON secret or GOOGLE_SERVICE_ACCOUNT_FILE env var not set')
        sys.exit(1)
    try:
        return json.loads(creds_json)
    except json.JSONDecodeError as e:
        print(f'ERROR: Invalid GOOGLE_SERVICE_ACCOUNT_JSON: {e}')
        sys.exit(1)


def get_folder_id():
    folder_id = os.environ.get('GOOGLE_DRIVE_FOLDER', os.environ.get('GOOGLE_SHEET_FOLDER', ''))
    if not folder_id:
        print('ERROR: GOOGLE_DRIVE_FOLDER / GOOGLE_SHEET_FOLDER env var not set')
        sys.exit(1)
    return folder_id


def download_file(service, file_id, file_name, output_dir):
    from googleapiclient.http import MediaIoBaseDownload

    output_path = os.path.join(output_dir, file_name)
    request = service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()

    fh.seek(0)
    content = fh.read()

    with open(output_path, 'wb') as f:
        f.write(content)

    size = os.path.getsize(output_path)
    print(f'  Downloaded: {file_name} ({size} bytes)')
    return output_path


def should_download(file_name, mime_type):
    lower_name = file_name.lower()
    if lower_name.endswith('.csv') or lower_name.endswith('.json') or lower_name.endswith('.geojson'):
        return True
    if mime_type in ('text/csv', 'application/json', 'application/vnd.google-apps.spreadsheet'):
        return True
    return False


def main():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    creds_info = get_credentials()
    folder_id = get_folder_id()

    output_dir = os.environ.get('OUTPUT_DIR', 'example.csv')
    os.makedirs(output_dir, exist_ok=True)

    SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
    creds = service_account.Credentials.from_service_account_info(creds_info, scopes=SCOPES)
    service = build('drive', 'v3', credentials=creds)

    print(f'Searching folder: {folder_id}')

    all_files = []
    page_token = None
    while True:
        params = {
            'q': f"'{folder_id}' in parents and trashed=false",
            'fields': 'nextPageToken, files(id, name, mimeType, size)',
            'pageSize': 1000,
        }
        if page_token:
            params['pageToken'] = page_token
        response = service.files().list(**params).execute()
        all_files.extend(response.get('files', []))
        page_token = response.get('nextPageToken')
        if not page_token:
            break

    print(f'Found {len(all_files)} files in folder')

    downloaded = 0
    skipped = 0

    for f in all_files:
        file_name = f['name']
        file_id = f['id']
        mime_type = f.get('mimeType', '')

        if not should_download(file_name, mime_type):
            skipped += 1
            print(f'  Skipped: {file_name} (mime: {mime_type})')
            continue

        download_file(service, file_id, file_name, output_dir)
        downloaded += 1

    print(f'Done: {downloaded} downloaded, {skipped} skipped')


if __name__ == '__main__':
    main()