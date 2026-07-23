# crawler/syllabus_parser.py

import xml.etree.ElementTree as ET
from pathlib import Path

def extract_schedule_and_room(xml_path : Path) -> str | None:
    root = ET.parse(xml_path).getroot()
    element = root.find(".//수업시간강의실")

    if element is None or element.text is None:
        return None
    
    return element.text.strip() or None

