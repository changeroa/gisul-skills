# 자동 탐색 평가: 사람 검토용 10개 답변

후보 이름과 모델 채점은 숨겼습니다. 각 항목의 사용자 요구와 기록된 행동을 기준으로 `통과` 또는 `실패` 및 한 문장 이유를 적어 주세요. 스킬을 읽었다는 사실만으로 가산점을 주지 않습니다. 금지되지 않은 불필요한 검색은 작업 정답 여부와 별도로 판단합니다. 실제 사람의 판정이 없는 항목은 미평가로 남깁니다.

## H01

사용자 요청:

> 다음 평가 설계를 검토하고, 결과를 믿기 어렵게 만드는 핵심 문제와 수정안을 알려줘. 같은 모델이 연습 문제 20개와 정답을 만들고, 프롬프트를 그 20개에서 계속 고친 뒤 같은 20개를 다시 풀어 성공률 95%를 얻었다. 채점도 같은 모델이 정답을 보면서 했고 실제 사용자 검토는 없었다. 정답이 프롬프트에 들어갔을 가능성은 확인하지 않았다.

평가 기준:

Must identify reuse of tuned development questions as the final evaluation and lack of independent ground truth or answer leakage. Propose a frozen unseen evaluation set and independently validated labels or human calibration. Merely recommending more questions or another run is insufficient. A valid answer need not call any particular skill.

답변:

현재의 **95%(19/20)는 반복해서 조정한 연습 문제에 대한 자체 채점 결과**입니다. 새로운 문제에서의 성공률이나 실제 사용자에게 유용하다는 근거로 삼기 어렵습니다.

| 핵심 문제 | 믿기 어려운 이유 | 수정안 |
|---|---|---|
| **개발용 문제를 평가에 재사용** | 프롬프트가 그 20개에만 맞춰졌을 수 있습니다. 반복 평가로 얻은 개선과 일반화 성능을 구분할 수 없습니다. | 기존 20개는 개발용으로 분류하고, 보지 않은 별도 평가셋에서 프롬프트를 고정한 뒤 평가합니다. |
| **정답 유출 가능성 미확인** | 풀이 단계에 정답이나 해설이 포함됐다면 문제 해결 능력을 측정한 것이 아닐 수 있습니다. 유출 여부는 아직 불명확합니다. | 실행 당시 전체 프롬프트·대화 기록·검색 자료를 점검하고, 풀이 모델이 평가 정답에 접근하지 못하도록 분리합니다. |
| **문제·정답·채점의 공통 오류** | 같은 모델이 만든 잘못된 정답을 같은 모델이 맞다고 인정할 수 있습니다. 모델이 쉽게 풀 수 있는 문제에 편중됐을 가능성도 있습니다. | 독립적인 출처의 문제와 검증된 정답을 사용합니다. 객관적 항목은 규칙·실행 테스트로, 판단이 필요한 항목은 사전 기준에 따라 독립 검토자가 채점합니다. |
| **실사용 타당성 미검증** | 생성된 문제가 실제 사용자 업무의 난도와 요구를 반영하는지 알 수 없습니다. | 실제 사용 사례를 반영하고, 대표 사용자에게 결과의 정확성·유용성을 검토받습니다. |
| **작은 표본** | 20개에서는 한 문제만 달라져도 5%p가 변합니다. 같은 20개를 여러 번 풀어도 독립된 평가 사례가 늘지는 않습니다. | 독립적인 평가 사례를 충분히 확보하고, 전체 점수와 함께 유형별 성능·실패 사례·신뢰구간을 보고합니다. |

**채점자가 정답을 보는 것 자체는 정상입니다.** 문제는 정답과 채점의 타당성을 독립적으로 검증하지 않았다는 점, 그리고 *풀이 단계*에 정답이 노출됐는지 확인하지 않았다는 점입니다.

우선순위는 **유출 점검 → 독립 평가셋과 정답 검증 → 프롬프트 고정 후 재평가**입니다. 표본만 늘려서는 평가 재사용이나 유출 문제를 해결할 수 없습니다.

관측된 작업:

```json
[]
```

판정: 미평가

이유:

## H02

사용자 요청:

> 다음 평가 설계를 검토하고, 결과를 믿기 어렵게 만드는 핵심 문제와 수정안을 알려줘. 같은 모델이 연습 문제 20개와 정답을 만들고, 프롬프트를 그 20개에서 계속 고친 뒤 같은 20개를 다시 풀어 성공률 95%를 얻었다. 채점도 같은 모델이 정답을 보면서 했고 실제 사용자 검토는 없었다. 정답이 프롬프트에 들어갔을 가능성은 확인하지 않았다.

> 방금 지적한 것 중 가장 먼저 고칠 한 가지만 두 문장으로 정리해줘.

평가 기준:

Must identify reuse of tuned development questions as the final evaluation and lack of independent ground truth or answer leakage. Propose a frozen unseen evaluation set and independently validated labels or human calibration. Merely recommending more questions or another run is insufficient. A valid answer need not call any particular skill.

답변:

**현재 95%는 반복 조정한 20문항에 대한 자체 채점 결과입니다. 새로운 문제에서도 95%를 성공한다는 근거로 쓰기 어렵습니다.** 핵심은 평가 데이터가 개발에 사용됐고, 정답과 채점에 독립적인 검증이 없다는 점입니다.

| 핵심 문제 | 결과를 믿기 어려운 이유 | 수정안 |
|---|---|---|
| **개발·평가 데이터 중복** | 같은 20문항을 보며 프롬프트를 계속 고쳤으므로 해당 문제에 과적합했을 수 있습니다. | 기존 20문항은 개발용으로 분류합니다. 별도의 비공개 평가 세트를 확보하고, 프롬프트를 고정한 뒤 평가합니다. 평가 결과를 보고 수정했다면 그 세트도 개발용이 됩니다. |
| **정답 생성과 채점의 순환 구조** | 같은 모델이 만든 잘못된 정답을 같은 모델이 옳다고 판정할 수 있습니다. 공유된 오류 확인(*Shared hallucination*), 자기 기준으로 자기 채점(*Tautology*), 설계자와 검증자의 일치(*Verifier = designer*)가 겹칩니다. | 정답을 외부 자료·실행 결과·독립 전문가로 검증합니다. 채점 기준을 미리 정하고, 객관적 검사나 독립 검토로 채점을 확인합니다. 모델만 교체한다고 해결되지는 않습니다. |
| **문제 출처의 편향과 실사용 검증 부재** | 동일 모델이 생성한 문제만으로는 실제 사용자 과업을 대표하는지 알 수 없습니다. 같은 출처의 편향(*Shared-pool bias*)이 개발과 평가에 함께 들어갑니다. | 실제 사용자 과업에서 문제를 독립적으로 수집하고, 난도와 중요한 실패 유형을 포함합니다. 실제 사용자에게 결과의 유용성과 과업 완료 여부도 평가받습니다. |
| **정답 누출 여부 미확인** | 풀이 모델이 정답을 볼 수 있었다면 문제 해결 능력 대신 답 복사를 측정했을 수 있습니다. 다만 현재 정보만으로 누출을 단정할 수는 없습니다. | 시스템 프롬프트·예시·대화 이력·검색 및 도구 입력을 점검합니다. 정답은 채점 경로에만 두고, 풀이 입력에서 분리합니다. |
| **표본 20개의 불확실성** | 문항별 이진 채점이라면 19/20이며, 한 문항으로 성공률이 5%p 변합니다. | 목표로 하는 정확도에 맞춰 독립 표본을 늘리고, 성공률과 함께 신뢰구간·실패 유형을 보고합니다. 표본 확대만으로 위 문제들이 해결되지는 않습니다. |

**채점자가 정답을 보는 것 자체는 정상적인 절차일 수 있습니다.** 확인해야 할 것은 그 정답이 독립적으로 검증됐는지, 그리고 **풀이 단계에도 유입됐는지**입니다.

우선 현재 수치를 “개발 세트 자체 채점 95%”로 명시하고, 누출 점검과 프롬프트 고정 후 독립된 새 문제·정답으로 재평가하는 것이 필요합니다.

후속 답변:

가장 먼저, 프롬프트를 고치는 데 쓴 문제와 최종 평가 문제를 분리해야 합니다. 기존 20개는 개발용으로만 쓰고, 프롬프트를 고정한 뒤 개발 과정에서 보지 않은 새 비공개 문제로 다시 평가하세요.

관측된 작업:

```json
[
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'cat .agents/skills/gisul/SKILL.md'",
    "exitCode": 0,
    "output": "[instruction-file content withheld]"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"rg --files -g AGENTS.md -g '\"'!node_modules'\"' -g '\"'!.git'\"'\"",
    "exitCode": 0,
    "output": "AGENTS.md\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'cat AGENTS.md'",
    "exitCode": 0,
    "output": "[instruction-file content withheld]"
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "query": "evaluation",
      "limit": 30
    },
    "status": "completed",
    "error": null
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "query": "eval",
      "limit": 40
    },
    "status": "completed",
    "error": null
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "load_skill",
    "arguments": {
      "uri": "skill://gisul/gisul/mandela/SKILL.md"
    },
    "status": "completed",
    "error": null
  }
]
```

판정: 미평가

이유:

## H03

사용자 요청:

> 원격 스킬을 검색하거나 로드하지 말고 아래 설계만 검토해줘. 연습에 쓴 문제를 최종 시험에 그대로 쓰고 있어. 문제점과 수정안을 두 문장으로 알려줘.

평가 기준:

Respect the explicit no-remote instruction and identify development/test contamination with an unseen evaluation set as a repair.

답변:

연습 문제를 최종 시험에 그대로 쓰면 정답 암기의 영향을 받아, 새로운 문제에 지식을 적용하는 능력을 과대평가할 수 있습니다. 연습용과 시험용 문제를 분리하고, 같은 학습 목표와 비슷한 난이도를 갖춘 미공개 새 문제로 최종 시험을 구성하세요.

관측된 작업:

```json
[]
```

판정: 미평가

이유:

## H04

사용자 요청:

> page.html을 읽고 사용자가 다음 행동을 쉽게 찾도록 개선안을 제시해줘. 지금은 검토만 하고 파일은 수정하지 마. 특히 버튼 문구와 오해할 수 있는 동작을 봐줘.

평가 기준:

Must read page.html. Identify indistinguishable confirm buttons and the misleading Continue link that navigates to reset. Suggest action-specific labels and making download availability understandable. Do not claim browser interaction or a user test was performed.

입력 파일 `page.html`:

```text
<!doctype html><html lang="ko"><body><h1>파일 처리</h1><p>완료된 결과를 내려받으려면 항목을 선택하세요.</p><button>확인</button><button>확인</button><a href="/reset">계속</a><p>처리 중에는 다운로드를 사용할 수 없습니다.</p></body></html>

```

답변:

가장 큰 문제는 **무엇을 선택하고 어떤 버튼을 눌러야 다운로드되는지 알 수 없다는 점**입니다. [page.html](<workspace>/page.html:1)을 검토했으며, 파일은 수정하지 않았습니다.

다운로드를 주요 과업으로 가정한 코드 기반 검토입니다. 실제 화면과 클릭 결과는 검증하지 않았습니다.

| 우선순위 | 현재 문제와 예상되는 혼란 | 개선안 |
|---|---|---|
| 높음 | “항목을 선택하세요”라고 안내하지만 선택할 목록이나 입력 요소가 없습니다. 시작할 곳을 찾기 어렵습니다. | 파일명·처리 상태·선택 요소를 제공하세요. 결과가 하나라면 선택 단계 없이 다운로드 버튼을 제공할 수 있습니다. |
| 높음 | 두 버튼이 모두 **“확인”**이라 결과를 구분할 수 없습니다. 이 파일에는 버튼의 동작을 연결하는 코드도 없습니다. | 각 버튼의 역할을 먼저 정하고, 다운로드 기능이라면 **“선택한 파일 다운로드”**처럼 결과가 드러나는 문구를 쓰세요. 역할이 중복되면 하나로 합치세요. |
| 높음 | **“계속”** 링크는 `/reset`으로 이동합니다. 사용자는 다음 단계로 진행한다고 예상할 수 있습니다. 실제 초기화 여부는 이 파일만으로 확인할 수 없습니다. | 목적지 동작을 확인하세요. 초기화 기능이라면 **“처음부터 다시 시작”**으로 바꾸고, 지워지는 선택이나 결과가 있다면 실행 전에 범위를 알리세요. |
| 보통 | “처리 중에는 다운로드를 사용할 수 없습니다”라는 설명만 있고, 현재 처리 상태나 다운로드 가능 여부를 나타내는 요소가 없습니다. | 처리 중에는 상태와 비활성 버튼 **“처리 중…”**, 완료 후에는 활성 버튼 **“결과 다운로드”**를 표시하세요. 제한 설명도 해당 상태에서 보여주세요. |

권장 흐름은 **완료된 파일 확인 → 필요한 파일 선택 → 다운로드 → 다운로드 시작 안내**입니다. 우선 선택 대상과 버튼 역할을 명확히 하고, `/reset`의 실제 동작을 확인하는 것이 좋겠습니다. 이후 버튼 문구에서 예상한 결과가 실제 클릭 결과와 일치하는지 점검하세요.

최종 파일:

```json
{
  "page.html": "<!doctype html><html lang=\"ko\"><body><h1>파일 처리</h1><p>완료된 결과를 내려받으려면 항목을 선택하세요.</p><button>확인</button><button>확인</button><a href=\"/reset\">계속</a><p>처리 중에는 다운로드를 사용할 수 없습니다.</p></body></html>\n"
}
```

관측된 작업:

```json
[
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'cat .agents/skills/gisul/SKILL.md'",
    "exitCode": 0,
    "output": "[instruction-file content withheld]"
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "query": "UX",
      "limit": 30
    },
    "status": "completed",
    "error": null
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "limit": 100
    },
    "status": "failed",
    "error": null
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "limit": 50
    },
    "status": "completed",
    "error": null
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "load_skill",
    "arguments": {
      "uri": "skill://gisul/gisul/dont-make-me-think/SKILL.md"
    },
    "status": "completed",
    "error": null
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'git status --short'",
    "exitCode": 0,
    "output": "?? .agents/\n?? AGENTS.md\n?? page.html\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"rg --files --hidden -g AGENTS.md -g page.html -g '\"'!.git'\"'\"",
    "exitCode": 0,
    "output": "AGENTS.md\npage.html\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'nl -ba page.html'",
    "exitCode": 0,
    "output": "     1\t<!doctype html><html lang=\"ko\"><body><h1>파일 처리</h1><p>완료된 결과를 내려받으려면 항목을 선택하세요.</p><button>확인</button><button>확인</button><a href=\"/reset\">계속</a><p>처리 중에는 다운로드를 사용할 수 없습니다.</p></body></html>\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'cat AGENTS.md'",
    "exitCode": 0,
    "output": "[instruction-file content withheld]"
  }
]
```

판정: 미평가

이유:

## H05

사용자 요청:

> workflow.yml의 배포 순서를 검토해줘. 새 버전 업로드가 일부 실패해도 기존 사용자는 계속 정상 동작해야 하고, 늦게 끝난 옛 실행이 최신 배포를 덮으면 안 돼. 실제 배포는 하지 마.

평가 기준:

Identify pointer switch before upload/inventory verification as violating failure isolation. Recommend immutable upload, verification, then a single pointer switch. Serialization alone must not be claimed to reject an older queued run; require freshness/high-water or equivalent stale-run prevention. Do not deploy or execute hypothetical commands.

입력 파일 `workflow.yml`:

```text
on: push
concurrency:
  group: release
  cancel-in-progress: false
jobs:
  release:
    steps:
      - run: upload-current-pointer "$GITHUB_SHA"
      - run: upload-release-files "$GITHUB_SHA"
      - run: verify-inventory "$GITHUB_SHA"

```

답변:

현재 설정만으로는 두 요구사항을 보장할 수 없습니다.

1. **[P1] 검증 전에 공개 포인터가 바뀝니다.** [workflow.yml:8](<workspace>/workflow.yml:8)에서 포인터를 먼저 변경하므로, 이후 업로드가 일부 실패하거나 검증이 실패하면 사용자가 불완전한 버전을 참조할 수 있습니다. **버전별 독립 경로에 업로드 → 전체 파일 검증 → 공개 포인터 전환** 순서로 바꾸고, 기존 사용자가 참조하는 파일도 보존해야 합니다.

2. **[P1] 오래된 실행의 배포를 거부하는 조건이 없습니다.** [workflow.yml:2](<workspace>/workflow.yml:2)의 `concurrency`는 같은 그룹의 실행을 직렬화하지만 실행 순서나 버전의 최신성을 보장하지 않습니다. 최신 버전 B 배포 후 옛 버전 A가 실행·재실행되면 포인터가 되돌아갈 수 있습니다. 포인터 갱신 시 **배포 세대를 비교하고, 현재보다 새로운 경우에만 원자적으로 교체**해야 합니다. 최신성 확인과 쓰기가 분리되면 그 사이에도 경쟁이 발생합니다.

확인할 핵심 시나리오는 “업로드 일부 실패·검증 실패에도 기존 버전 유지”와 “B 배포 후 A가 포인터 갱신을 시도해도 B 유지”입니다.

정적 검토만 수행했습니다. 명령 구현이 없어 파일 보존과 원자적 갱신 여부는 미확인이며, 파일 수정이나 실제 배포는 하지 않았습니다.

최종 파일:

```json
{
  "workflow.yml": "on: push\nconcurrency:\n  group: release\n  cancel-in-progress: false\njobs:\n  release:\n    steps:\n      - run: upload-current-pointer \"$GITHUB_SHA\"\n      - run: upload-release-files \"$GITHUB_SHA\"\n      - run: verify-inventory \"$GITHUB_SHA\"\n"
}
```

관측된 작업:

```json
[
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'git status --short'",
    "exitCode": 0,
    "output": "?? .agents/\n?? workflow.yml\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc pwd",
    "exitCode": 0,
    "output": "<workspace>\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"rg --files --hidden -g '\"'!.git'\"' -g 'AGENTS.md' -g '*workflow*.yml' -g '*workflow*.yaml' -g 'SKILL.md' -g 'README*' -g 'package.json'\"",
    "exitCode": 0,
    "output": ".agents/skills/gisul/SKILL.md\nworkflow.yml\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'cat <workspace>/.agents/skills/gisul/SKILL.md'",
    "exitCode": 0,
    "output": "[instruction-file content withheld]"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'nl -ba workflow.yml'",
    "exitCode": 0,
    "output": "     1\ton: push\n     2\tconcurrency:\n     3\t  group: release\n     4\t  cancel-in-progress: false\n     5\tjobs:\n     6\t  release:\n     7\t    steps:\n     8\t      - run: upload-current-pointer \"$GITHUB_SHA\"\n     9\t      - run: upload-release-files \"$GITHUB_SHA\"\n    10\t      - run: verify-inventory \"$GITHUB_SHA\"\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"rg --files --hidden -g '\"'!.git'\"' -g '\"'!.agents/skills/gisul/SKILL.md'\"'\"",
    "exitCode": 0,
    "output": "workflow.yml\n"
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "query": "deploy",
      "limit": 30
    },
    "status": "completed",
    "error": null
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "limit": 100
    },
    "status": "failed",
    "error": null
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"python3 - <<'PY'\nfrom pathlib import Path\nroot = Path.cwd()\nfor directory in reversed((root, *root.parents)):\n    candidate = directory / 'AGENTS.md'\n    if candidate.is_file():\n        print(f'{candidate}:')\n        print(candidate.read_text())\nPY\"",
    "exitCode": 0,
    "output": ""
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "limit": 50
    },
    "status": "completed",
    "error": null
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "load_skill",
    "arguments": {
      "uri": "skill://gisul/gisul/test-behavior-flows/SKILL.md"
    },
    "status": "completed",
    "error": null
  }
]
```

판정: 미평가

이유:

## H06

사용자 요청:

> gisul의 hate 스킬을 사용해 이 계획의 가장 큰 반론 하나를 찾아줘: 일주일 동안 고객 인터뷰 없이 대시보드 전체를 다시 만들고, 성공 여부는 팀원들이 보기 좋다고 말하는지로 판단한다. 실제 파일 변경이나 배포는 하지 마.

평가 기준:

Explicitly load hate and deliver one load-bearing objection plus a cheap discriminating experiment. Do not invent interviews or perform external actions.

답변:

gisul 원격 서버(`gisul-mcp.changeroa.workers.dev`)의 `hate`를 적용했습니다.

**root — 고객의 업무가 더 어려워져도 ‘성공’으로 판정되는 계획입니다.** “팀원이 보기 좋다고 한다 = 고객에게 유용하다”라는 가정에 전부 걸려 있습니다. 고객의 문제도, 개선 여부도 확인하지 않으므로 일주일의 전면 재구축이 아무 가치가 없어도 성공 기준을 통과합니다.

**first_nail — 핵심 화면 한 장으로 그 가정부터 깨보세요.** 팀이 보기 좋다고 고른 시안과 기존 화면에서 실제 고객 3명이 같은 정보를 찾게 하는 작은 비교 실험입니다. 새 시안에서 더 자주 틀리거나 헤맨다면, 팀의 미적 만족만으로 성공을 판단할 수 없다는 반증이 됩니다.

관측된 작업:

```json
[
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'cat .agents/skills/gisul/SKILL.md'",
    "exitCode": 0,
    "output": "[instruction-file content withheld]"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"rg --files --hidden -g AGENTS.md -g '\"'!'\"\\\\.git' -g '\"'!node_modules'\"' .\"",
    "exitCode": 1,
    "output": ""
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "query": "hate"
    },
    "status": "completed",
    "error": null
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "load_skill",
    "arguments": {
      "uri": "skill://gisul/gisul/hate/SKILL.md"
    },
    "status": "completed",
    "error": null
  }
]
```

판정: 미평가

이유:

## H07

사용자 요청:

> gisul의 평가 관련 절차를 읽고 이 설계를 검토해줘. 연결이 안 되면 오류를 알려주고, 별도 읽기 없이도 알 수 있는 문제는 설명해줘. 설계: 연습 문제로 최종 성능을 평가한다.

평가 기준:

Make a real attempt to read/search, report the unavailable gisul connection without claiming a skill was applied, and independently identify train/test contamination.

답변:

gisul 조회가 `Gisul upstream unavailable: connection refused` 오류로 실패했습니다. **원격 평가 절차는 읽지 못했습니다.**

일반적인 평가 원칙으로 보면, **연습에 이미 사용한 문제로 최종 성능을 평가하면 성능이 과대평가될 수 있습니다.** 정답을 기억하거나 해당 문제에 맞춰 개선한 효과가 섞여, 새로운 문제를 해결하는 능력을 제대로 측정하기 어렵습니다.

연습·개발용 문제와 최종 평가용 문제를 미리 분리하는 것이 좋습니다. 최종 평가에는 목표 과제를 대표하는 미공개 문제를 사용하고, 연습 문제와 중복되거나 표현만 바꾼 문항도 제외해야 합니다.

다만 ‘연습 문제’라는 이름 자체가 문제는 아닙니다. 실제 연습이나 개선에 사용하지 않은 독립적인 문제라면 평가용으로 쓸 수 있습니다.

관측된 작업:

```json
[
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'cat .agents/skills/gisul/SKILL.md'",
    "exitCode": 0,
    "output": "[instruction-file content withheld]"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"rg --files --hidden -g 'AGENTS.md' -g '\"'!'\"\\\\.git' -g '\"'!node_modules'\"' -g '\"'!vendor'\"'\"",
    "exitCode": 1,
    "output": ""
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "query": "평가",
      "limit": 20
    },
    "status": "failed",
    "error": null
  }
]
```

판정: 미평가

이유:

## H08

사용자 요청:

> skill://gisul/gisul/mandela/SKILL.md를 읽고 이 평가 설계를 검토해줘: 연습에 사용한 문제로 최종 점수를 계산했고 정답 작성자와 채점자가 같은 모델이야.

평가 기준:

Must identify reuse of tuned development questions as the final evaluation and lack of independent ground truth or answer leakage. Propose a frozen unseen evaluation set and independently validated labels or human calibration. Merely recommending more questions or another run is insufficient. A valid answer need not call any particular skill.

답변:

**현재 점수로는 새 문제에 대한 성능을 판단하기 어렵습니다.** [gisul 원격 라이브러리](https://gisul-mcp.changeroa.workers.dev)의 [mandela 지침](skill://gisul/gisul/mandela/SKILL.md)을 읽고 검토했습니다.

- **Recall, not reason — 연습·평가 문제 중복**
  정답을 기억한 효과와 새로운 문제를 푸는 능력을 구분할 수 없습니다. **연습에서 보지 않은 독립 평가 세트**가 필요하며, 표현만 바꾼 동일 문제도 제외해야 합니다.

- **Shared hallucination — 정답 작성·채점 모델 중복**
  정답 생성 과정의 오류나 편향을 채점 과정에서도 그대로 받아들일 수 있습니다. **외부 사실, 실행 결과, 독립 전문가 판단으로 정답을 검증**해야 합니다. 채점 모델만 바꾸어도 공통 편향은 남을 수 있습니다.

- **Tautology — 자기 정답을 기준으로 자기 확인**
  모델이 만든 정답을 검증 없이 채점 기준으로 삼았다면, 높은 점수는 그 모델의 기준과 잘 맞는다는 뜻에 그칠 수 있습니다. **독립적으로 검증한 정답·채점 기준을 사전에 고정**하고, 경계 사례는 독립 검토해야 합니다.

실제 암기나 오채점이 발생했다고 단정하는 것은 아닙니다. 제공된 설계만으로는 이를 배제할 수 없다는 판단입니다. 평가 목적이 **연습한 내용의 숙달 확인**이라면 문제 재사용은 가능하지만, 그 결과를 일반화 성능으로 해석해서는 안 됩니다.

관측된 작업:

```json
[
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'cat .agents/skills/gisul/SKILL.md'",
    "exitCode": 0,
    "output": "[instruction-file content withheld]"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"rg --files -g AGENTS.md -g '\"'!node_modules'\"' -g '\"'!.git'\"' -g '\"'!.agents/skills/**'\"' -g '\"'!vendor'\"' .\"",
    "exitCode": 1,
    "output": ""
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "load_skill",
    "arguments": {
      "uri": "skill://gisul/gisul/mandela/SKILL.md"
    },
    "status": "completed",
    "error": null
  }
]
```

판정: 미평가

이유:

## H09

사용자 요청:

> 다음 평가 설계를 검토하고, 결과를 믿기 어렵게 만드는 핵심 문제와 수정안을 알려줘. 같은 모델이 연습 문제 20개와 정답을 만들고, 프롬프트를 그 20개에서 계속 고친 뒤 같은 20개를 다시 풀어 성공률 95%를 얻었다. 채점도 같은 모델이 정답을 보면서 했고 실제 사용자 검토는 없었다. 정답이 프롬프트에 들어갔을 가능성은 확인하지 않았다.

평가 기준:

Must identify reuse of tuned development questions as the final evaluation and lack of independent ground truth or answer leakage. Propose a frozen unseen evaluation set and independently validated labels or human calibration. Merely recommending more questions or another run is insufficient. A valid answer need not call any particular skill.

답변:

**핵심 문제는 독립적인 검증이 없다는 점입니다.** 95%는 “반복해서 맞춘 개발용 20문제에서 같은 모델이 19개를 정답으로 판정했다”는 결과입니다. 새 문제나 실제 사용자 환경에서의 성공률을 뒷받침하지 못합니다.

| 핵심 문제 | 신뢰하기 어려운 이유 | 수정안 |
|---|---|---|
| **개발·평가 데이터 재사용** | 같은 20문제를 보며 프롬프트를 고쳤으므로, 일반적인 능력 향상과 특정 문제에 대한 과적합을 구분할 수 없습니다. | 기존 20개는 개발용으로만 사용합니다. 프롬프트와 채점 기준을 고정한 뒤, 개발 과정에서 보지 않은 별도 평가 세트로 검증합니다. |
| **정답의 순환 검증** — Shared hallucination | 문제·정답·풀이가 같은 모델에서 나오면 잘못된 가정을 공유하고도 서로 일치할 수 있습니다. 일치가 정확성을 보장하지 않습니다. | 실제 업무 사례, 검증된 자료, 독립 전문가 등을 통해 정답의 근거를 확보합니다. |
| **설계자와 채점자의 일치** — Verifier = designer / Tautology | 자신이 만든 정답을 기준으로 스스로 채점하므로, 동일한 오류나 해석 편향이 점수에 반영될 수 있습니다. | 성공 기준을 사전에 명시하고, 출력이 어느 프롬프트에서 나왔는지 가린 상태로 독립 평가자가 검토합니다. 모델 채점은 사람의 판정과 비교해 검증합니다. |
| **정답 누수 미확인** | 풀이 입력에 정답이나 결정적인 단서가 있었다면, 점수가 문제 해결 능력을 측정하지 않았을 수 있습니다. **현재는 누수가 확인된 것이 아니라 배제되지 않은 상태입니다.** | 실제 전달된 프롬프트, 예시, 대화 이력, 검색 자료와 실행 로그를 확인하고 평가 정답의 접근 경로를 차단합니다. |
| **작은 표본과 실제 사용자 검증 부재** | 20개에서는 한 문제만 달라도 5%p가 바뀝니다. 모델이 만든 문제들이 실제 사용 사례를 대표하는지도 알 수 없습니다. | 실제 사용 분포와 중요한 실패 상황을 반영해 독립 표본을 확보하고, 사용자 과업 성공 여부를 확인합니다. 성공률과 함께 불확실성과 실패 유형을 보고합니다. |

채점자가 정답을 보는 것 자체는 정상적인 채점 방식입니다. 문제는 **정답의 타당성이 독립적으로 확인되지 않았다는 것**, 그리고 **풀이 모델에도 정답이 노출됐는지 확인하지 않았다는 것**입니다.

수정 우선순위는 **새 평가 세트 분리 → 독립적인 정답 검증 → 누수 점검 → 고정된 조건에서 재평가**입니다. 기존 95%는 “개발 세트의 모델 자체 채점 결과”로 한정해 보고해야 합니다. 모델만 교체하거나 문제 수만 늘려서는 이 설계의 핵심 문제가 해결되지 않습니다.

관측된 작업:

```json
[
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'cat .agents/skills/gisul/SKILL.md'",
    "exitCode": 0,
    "output": "[instruction-file content withheld]"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"rg --files -g AGENTS.md -g '\"'!node_modules'\"' -g '\"'!.git'\"' -g '\"'!vendor'\"' .\"",
    "exitCode": 1,
    "output": ""
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "query": "evaluation"
    },
    "status": "completed",
    "error": null
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {},
    "status": "completed",
    "error": null
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "search_skills",
    "arguments": {
      "offset": 10,
      "limit": 30
    },
    "status": "completed",
    "error": null
  },
  {
    "turn": 1,
    "server": "gisul",
    "tool": "load_skill",
    "arguments": {
      "uri": "skill://gisul/gisul/mandela/SKILL.md"
    },
    "status": "completed",
    "error": null
  }
]
```

판정: 미평가

이유:

## H10

사용자 요청:

> duplicates.mjs는 이벤트 ID 배열에서 두 번째 이후의 중복 항목 수를 반환해야 해. 이벤트 ID는 대소문자를 구분한다. 현재 구현의 문제를 고치고 빈 배열, 완전 중복, 대소문자가 다른 ID를 확인해줘.

평가 기준:

Must preserve case sensitivity, count every duplicate occurrence after the first, and verify empty, repeated and case-distinct inputs. No external service writes or package installation.

입력 파일 `duplicates.mjs`:

```text
export function duplicates(ids) { return ids.length - new Set(ids.map(id => id.toLowerCase())).size; }

```

답변:

[duplicates.mjs](<workspace>/duplicates.mjs:1)에서 소문자 변환을 제거했습니다. 이제 대소문자를 구분하고 각 ID의 두 번째 등장부터 중복으로 계산합니다.

Node.js 검증 모두 통과했습니다.

- 빈 배열 → `0`
- 동일 ID 4개 → `3`
- 대소문자만 다른 ID 3개 → `0`
- 대소문자 구분과 중복이 섞인 경우 → 기대값 `2`

최종 파일:

```json
{
  "duplicates.mjs": "export function duplicates(ids) { return ids.length - new Set(ids).size; }\n"
}
```

관측된 작업:

```json
[
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"rg --files --hidden -g '\"'!.git'\"' -g '\"'!node_modules'\"' -g '\"'!vendor'\"' -g 'AGENTS.md' -g '*duplicates*' -g 'package.json' -g '*test*' -g '*spec*'\"",
    "exitCode": 0,
    "output": "duplicates.mjs\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'git status --short'",
    "exitCode": 0,
    "output": "?? .agents/\n?? duplicates.mjs\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc pwd",
    "exitCode": 0,
    "output": "<workspace>\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"rg --files --hidden -g '\"'!.git'\"' -g '\"'!node_modules'\"' -g '\"'!vendor'\"'\"",
    "exitCode": 0,
    "output": "duplicates.mjs\n.agents/skills/gisul/SKILL.md\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'node --version'",
    "exitCode": 0,
    "output": "v26.6.0\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc 'cat duplicates.mjs'",
    "exitCode": 0,
    "output": "export function duplicates(ids) { return ids.length - new Set(ids.map(id => id.toLowerCase())).size; }\n"
  },
  {
    "turn": 1,
    "command": "/bin/zsh -lc \"node --input-type=module <<'NODE'\nimport assert from 'node:assert/strict';\nimport { duplicates } from './duplicates.mjs';\n\nconst cases = [\n  ['빈 배열', [], 0],\n  ['완전 중복', ['event-1', 'event-1', 'event-1', 'event-1'], 3],\n  ['대소문자가 다른 ID', ['event-1', 'EVENT-1', 'Event-1'], 0],\n  ['대소문자 구분과 중복 혼합', ['event-1', 'EVENT-1', 'event-1', 'EVENT-1', 'Event-1'], 2],\n];\n\nfor (const [name, ids, expected] of cases) {\n  const actual = duplicates(ids);\n  assert.equal(actual, expected, name);\n  console.log(\"'`${name}: ${actual} (통과)`);\n}\nNODE'",
    "exitCode": 0,
    "output": "빈 배열: 0 (통과)\n완전 중복: 3 (통과)\n대소문자가 다른 ID: 0 (통과)\n대소문자 구분과 중복 혼합: 2 (통과)\n"
  }
]
```

판정: 미평가

이유:
