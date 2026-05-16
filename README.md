# Local Notion Memo

GitHub Pages에 그대로 올려서 사용할 수 있는 **정적 메모 앱**입니다. 서버와 데이터베이스 없이 동작하며, 메모 데이터는 브라우저 `localStorage`에 자동 저장됩니다.

## 포함 기능

- Notion 스타일 블록 편집기
- 줄 시작 Markdown 단축 변환
  - `#` + Space → H1
  - `##` + Space → H2
  - `###` + Space → H3
  - `-`, `*`, `+` + Space → 글머리 목록
  - `1.`, `a.`, `i.` + Space → 번호 목록
  - `[]` + Space 또는 `[]` 입력 → 체크박스
  - `>` + Space → 토글
  - `---` → 구분선
  - ``` ``` ``` + Space → 코드 블록
- `/` 슬래시 명령어
  - `/텍스트`, `/제목1`, `/제목2`, `/제목3`
  - `/글머리`, `/번호`, `/체크`, `/토글`, `/인용`, `/코드`, `/구분선`
  - `/이미지`, `/동영상`, `/북마크`
  - `/빨강`, `/파랑`, `/노랑 배경`, `/기본 색상` 등 색상 명령
  - `/복제`, `/삭제`
- 인라인 서식 툴바
  - 상단 고정 툴바와 드래그 선택 시 나타나는 플로팅 툴바
  - 굵게, 기울임, 밑줄, 취소선, 인라인 코드, 링크
  - 선택 영역 폰트, 글자 크기, 글자색, 배경색
- 여러 메모 탭
- 메모 검색, 검색어 하이라이트
- 태그, 핀 고정, 보관함
- 메모 삭제와 삭제 되돌리기
- 현재 메모 전체를 일반 텍스트로 복사
- 현재 메모 전체를 Markdown으로 복사
- 현재 메모를 Markdown 파일로 저장
- Markdown 파일을 새 메모로 가져오기
- Markdown 표 가져오기/편집/내보내기
- 모든 메모 JSON 백업/복원
- 이미지 URL 삽입 및 클립보드 이미지 붙여넣기
- YouTube, Vimeo, mp4/webm URL 영상 삽입
- 라이트/다크/시스템 테마
- 모바일 하단 액션바와 슬라이드식 메모 목록
- 모바일 사이드패널 닫기 버튼
- 삭제한 블록/메모 되돌리기
- 저장소 사용량 표시
- Pretendard 기본 폰트
- 블록 복제, 삭제, 위/아래 이동, 들여쓰기
- `Enter` 1번은 같은 블록 안 줄바꿈, `Enter` 2번은 새 블록 생성
- `/`만 입력하면 전체 명령 목록 표시, `/영상`으로 동영상 삽입 명령 검색
- 방향키로 인접 블록 이동, Ctrl/Cmd+A로 본문 전체 선택

## 로컬 실행

별도 빌드가 필요 없습니다.

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다.

## GitHub Pages 배포

1. 새 GitHub 저장소를 만듭니다.
2. 이 폴더의 파일을 저장소 루트에 업로드합니다.
   - `index.html`
   - `styles.css`
   - `app-core.js`
   - `app.js`
   - `.nojekyll`
   - `README.md`
3. GitHub 저장소에서 **Settings → Pages**로 이동합니다.
4. **Deploy from a branch**를 선택합니다.
5. Branch를 `main`, Folder를 `/ (root)`로 설정합니다.
6. 생성된 Pages URL로 접속합니다.

## 저장 방식 주의사항

이 앱은 서버 저장이 아니라 브라우저 로컬 저장입니다.

- 같은 브라우저와 같은 도메인에서만 저장 데이터가 유지됩니다.
- 브라우저 저장소 삭제, 시크릿 모드 종료, 도메인 변경 시 데이터가 사라질 수 있습니다.
- 중요한 메모는 상단의 **백업** 버튼으로 JSON 파일을 내려받아 보관하세요.
- 개별 메모는 **MD 저장** 버튼으로 Markdown 파일로 보관할 수 있습니다.
- 클립보드 이미지를 많이 붙여넣으면 `localStorage` 용량 제한에 걸릴 수 있습니다. 큰 이미지는 URL 삽입 방식을 권장합니다.
- 화면의 저장소 상태가 경고 수준이면 JSON 백업을 먼저 내려받고 큰 이미지 데이터는 URL 방식으로 정리하세요.

## 파일 구조

```text
notion-memo-app/
├── index.html
├── styles.css
├── app-core.js
├── app.js
├── .nojekyll
├── tests/
│   └── app-core.test.js
├── docs/
│   └── superpowers/
│       └── plans/
└── README.md
```

## 커스터마이징 아이디어

- `styles.css`에서 색상 변수와 폭을 조정할 수 있습니다.
- 기본 폰트는 Pretendard 웹폰트이며, `styles.css`의 `--font` 변수에서 바꿀 수 있습니다.
- `app.js`의 `buildCommands()`에서 슬래시 명령을 추가할 수 있습니다.
- `app-core.js`에는 검색, 태그, Markdown 가져오기 등 테스트 가능한 순수 로직이 들어 있습니다.
- 백엔드 저장이 필요하면 `persistState()`와 `loadState()`를 Firebase, Supabase, GitHub Gist API 등으로 교체하면 됩니다.

## 테스트

Node.js 22 이상이 있으면 순수 로직 테스트를 실행할 수 있습니다.

```bash
node --test tests/app-core.test.js
```
