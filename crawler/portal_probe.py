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
                
        print("\n 조회조건 설정")

        # 현재 화면에 존재하는 학부 정규학기 하나를 선택
        lecture_frame.locator(
            "#mainContent_ddl학년도"
        ).select_option(value="01_2026_2")

        # 학년도 선택으로 postback이 발생할 수 있으므로 잠시 대기
        page.wait_for_timeout(2000)

        # iframe 다시 찾기
        lecture_frame = next(
            frame for frame in page.frames if "navi.inje.ac.kr/AllUsers/Lecture.aspx" in frame.url
        )


        lecture_frame.locator(
            "#mainContent_ddl수업트랙"
        ).select_option(value="1")

        lecture_frame.locator(
            "#mainContent_ddl소속"
        ).select_option(value="01995") # 약학과 01995

        lecture_frame.locator(
            "#mainContent_ddl작성언어"
        ).select_option(value="1")

        print("조회")

        lecture_frame.locator(
            "#mainContent_btn조회"
        ).click()

        page.wait_for_timeout(3000)

        # iframe 다시 찾기
        lecture_frame = next(
            frame for frame in page.frames if "navi.inje.ac.kr/AllUsers/Lecture.aspx" in frame.url
        )

        # 조회 결과 저장
        result_html = lecture_frame.content()

        (OUTPUT_DIR / "lecture-result.html").write_text(
            result_html,
            encoding="utf-8"
        )

        lecture_frame.locator("body").screenshot(
            path=str(OUTPUT_DIR / "lecture-result.png")
        )

        tables = lecture_frame.locator("table")

        print(f"table 개수 : {tables.count()}")

        for table_index in range(tables.count()):
            table = tables.nth(table_index)

            print(
                    f"\n[table {table_index}] "
                    f"id={table.get_attribute('id')!r}, "
                    f"class={table.get_attribute('class')!r}"
                )

            print(table.inner_text()[:1000])

            print("\n조회 후 발견된 링크와 버튼:")

            controls = lecture_frame.locator(
                "a, button, input[type='button'], input[type='submit']"
            )

        # 수업계획서 XML & pdf 시험 다운로드

        xml_url = (
            "https://navi.inje.ac.kr/MRD/Subject/"
            "SubjB0011R_XML.aspx"
            "?SYS_CD=01"
            "&YY=2026"
            "&SMST=2"
            "&TR=1"
            "&SUBJ=ADA140"
            "&BUNBAN=1"
            "&LAN=1"
            "&CAP=2"
            "&ID="
            "&AGIN=A"
        )

        xml_response = context.request.get(xml_url)

        print(f"XML status: {xml_response.status}")
        print(f"Content-Type: {xml_response.headers.get('content-type')}")

        xml_text = xml_response.text()

        (OUTPUT_DIR / "syllabus-ADA140-1.xml").write_text(
            xml_text,
            encoding="utf-8",
        )

        # PDF 생성 요청

        pdf_create_response = context.request.post(
            "https://reporttool.inje.ac.kr/ReportingServer/service",
            headers={
                "Accept": "*/*",
                "Content-Type": (
                    "application/x-www-form-urlencoded; charset=UTF-8"
                ),
                "Origin": "https://navi.inje.ac.kr",
                "Referer": "https://navi.inje.ac.kr/",
            },
            form={
                "opcode": "500",
                "mrd_path": (
                    "https://navi.inje.ac.kr/MRD/Subject/"
                    "SubjB0011R_02.mrd"
                ),
                "mrd_param": f"/rfn [{xml_url}]",
                "export_type": "pdf",
                "protocol": "sync",
            },
        )

        print("PDF 생성 상태:", pdf_create_response.status)

        pdf_create_text = pdf_create_response.text().strip()
        print("PDF 생성 응답:", pdf_create_text)

        if not pdf_create_response.ok:
            raise RuntimeError(
                f"PDF 생성 요청 실패: HTTP "
                f"{pdf_create_response.status} / {pdf_create_text}"
            )

        if not pdf_create_text.startswith("1|"):
            raise RuntimeError(
                f"Crownix PDF 생성 실패: {pdf_create_text}"
            )

        temporary_pdf_path = pdf_create_text.split("|", 1)[1].strip()

        if not temporary_pdf_path.lower().endswith(".pdf"):
            raise RuntimeError(
                f"잘못된 임시 PDF 경로: {temporary_pdf_path}"
            )

        print("임시 PDF 경로:", temporary_pdf_path)

        pdf_download_response = context.request.get(
            "https://reporttool.inje.ac.kr/ReportingServer/download",
            params={
                "filename": temporary_pdf_path,
                "delete": "true",
                "attatchment": "true",
            },
        )

        print("PDF 다운로드 상태:", pdf_download_response.status)
        print(
            "PDF Content-Type:",
            pdf_download_response.headers.get("content-type"),
        )

        pdf_bytes = pdf_download_response.body()

        if not pdf_download_response.ok:
            raise RuntimeError(
                f"PDF 다운로드 실패: HTTP {pdf_download_response.status}"
            )

        if not pdf_bytes.startswith(b"%PDF"):
            preview = pdf_bytes[:300].decode(
                "utf-8",
                errors="replace",
            )
            raise RuntimeError(
                f"다운로드된 파일이 PDF가 아닙니다: {preview}"
            )

        pdf_output_path = OUTPUT_DIR / "syllabus-ADA140-1.pdf"
        pdf_output_path.write_bytes(pdf_bytes)

        print("PDF 저장 완료:", pdf_output_path)
        print("PDF 크기:", len(pdf_bytes), "bytes")




if __name__ == "__main__" : 
    main()