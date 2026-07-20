from pathlib import Path 
from playwright.sync_api import sync_playwright

PORTAL_URL = "https://my.inje.ac.kr/artifact/viewer/1304?k=1304"

PROJECT_ROOT = Path(__file__).resolve().parents[1]

PROFILE_DIR  = PROJECT_ROOT / "crawler" / "browser-profile"
OUTPUT_DIR = PROJECT_ROOT / "crawler" / "output"

def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=False,
            viewport={"width" : 1440, "height" : 1000}
        )

        page = context.pages[0]
        page.goto(PORTAL_URL, wait_until="domcontentloaded")

        print("Please login to your Portal account")
        print("Press 'ENTER' when the site is fully loaded")
        input() # receive user ENTER input

        page.screenshot(
            path = str(OUTPUT_DIR / "portal-page.png"),
            full_page=True
        )

        html = page.content()

        (OUTPUT_DIR / "portal-page.html").write_text(
            html,
            encoding="utf-8"
        )

        print(f"Current URL : {page.url}")
        print(f"Page title : {page.title()}")
        print(f"# of Frames : {len(page.frames)}")

        # for index, frame in enumerate(page.frames):
        #     print(f"[frame {index}] {frame.url}")

        lecture_frame = next(
            (
                frame 
                for frame in page.frames
                if "navi.inje.ac.kr/AllUsers/Lecture.aspx" in frame.url
            ),
            None
        )
        
        if lecture_frame is None :
            raise RuntimeError("수업계획서 iframe을 찾지 못했습니다")
        
        lecture_frame.wait_for_load_state("domcontentloaded")

        # iframe 자체의 HTML도 별도 저장
        lecture_html = lecture_frame.content()

        (OUTPUT_DIR / "lecture-frame.html").write_text(
            lecture_html,
            encoding="utf-8"
        )

        # 드롭다운들의 id, name, 선택지 출력
        selects = lecture_frame.locator('select')

        print(f"\n수업계획서 화면의 드롭다운 메뉴 개수 : {selects.count()}")

        for index in range(selects.count()):
            select = selects.nth(index)

            select_id = select.get_attribute("id")
            select_name = select.get_attribute("name")

            options = select.locator("option")

            print(f"\n[select {index}] id={select_id!r}, name={select_name!r}")

            for option_index in range(options.count()):
                option = options.nth(option_index)

                print(
                    f"  [{option_index}] "
                    f"text={option.inner_text().strip()!r}, "
                    f"value={option.get_attribute('value')!r}"
                    )

        print("(HTML, Screenshot) has been saved in (crawler/output)")
        # print("Press 'Enter' to close the browser")

        # context.close() # close browser

if __name__ == "__main__" : 
    main()