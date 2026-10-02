---
name: "clean-code-concurrency"
description: "Clean Code 2판의 concurrency 원칙으로 threaded·async·parallel code를 설계, 리뷰, 리팩터링한다. shared mutable state, race, atomicity, locks, task ownership, deadlock, starvation, shutdown, cancellation, bounded resources, flaky concurrency tests와 sporadic failure를 다룰 때 사용한다."
---

# Clean Code: Concurrency

동시성은 성능 장식이 아니라 별도의 복잡성 원인이다. 실제 latency·throughput·responsiveness·구조적 분리가 필요할 때만 도입하고, 공유 상태·lifecycle·failure를 작고 명시적인 경계 안에 둔다.

일반 객체·컴포넌트 설계는 `clean-code-design`, 시스템 프로세스·서비스 경계는 `clean-code-architecture`와 함께 사용할 수 있다. 2판 22장의 출처와 적용 한계는 `skill://gisul/gisul/clean-code/references/sources-and-guardrails.md`를 따른다.

## 모드와 권한

리뷰 요청은 읽기 전용이다. 파일 수정은 사용자가 구현·리팩터링을 요청한 범위에서만 수행한다. 테스트·빌드 실행, commit·push·PR·배포와 외부 효과는 호스트와 저장소 정책 및 명시된 권한을 따른다. 사용자의 기존 변경을 덮어쓰거나 무관한 작업을 되돌리지 않는다.

## 1. 동시성이 필요한지 증명한다

다음 중 어떤 문제를 푸는지 먼저 적는다.

- 외부 I/O 대기를 겹쳐 latency나 throughput을 개선한다.
- 서로 독립적인 CPU 작업을 실제 parallel hardware에 분배한다.
- UI/event loop의 응답성을 유지한다.
- producer와 consumer, request와 background work의 lifecycle을 분리한다.
- 여러 독립 작업의 격리와 orchestration을 명확히 한다.

측정이나 구조적 요구 없이 “비동기가 더 빠르다”라고 가정하지 않는다. scheduling, context switch, queue, synchronization과 debugging 비용을 포함해 sequential 대안과 비교한다. 작은 데이터와 짧은 작업에서는 concurrency가 더 느릴 수 있다.

## 2. 실행 모델과 소유권을 그린다

코드를 바꾸기 전에 다음을 한 표나 짧은 도식으로 정리한다.

- task/thread/process를 누가 생성하고 누가 종료를 기다리는가?
- 각 상태의 단일 소유자는 누구인가?
- 어떤 상태가 immutable, copied, partitioned, shared인가?
- 공유 상태를 읽고 쓰는 모든 경로와 atomicity 단위는 무엇인가?
- queue/channel의 용량과 backpressure는 어떻게 처리하는가?
- 취소, timeout, retry와 duplicate work의 계약은 무엇인가?
- 오류는 어디로 전달되고 다른 작업을 중단시키는가?
- startup과 graceful/forced shutdown의 순서는 무엇인가?

ownership과 lifecycle을 설명할 수 없으면 lock을 추가하기 전에 모델을 단순화한다.

## 3. concurrency code를 정책에서 분리한다

scheduling, locking, retry loop와 queue plumbing을 business rule에 흩뜨리지 않는다.

- 가능한 한 순수한 policy function과 concurrent orchestration을 분리한다.
- business object가 executor, mutex와 scheduler를 직접 알 필요가 없게 경계를 둔다.
- thread 수, queue 크기, timeout을 하드코딩된 전역 상수보다 구성 가능한 경계로 둔다. 무제한 tuning surface를 만들지는 않는다.
- 단일 thread로도 핵심 policy를 테스트할 수 있게 한다.
- concurrency abstraction이 오류·취소·순서를 숨기지 않게 한다.

동시성 자체가 하나의 변경 이유다. 분리 결과가 간단한 sequential logic과 작은 coordination layer가 되는지 확인한다.

## 4. 공유 mutable state를 최소화한다

우선순위는 보통 다음과 같다.

1. 값을 immutable로 만든다.
2. 작업마다 copy하거나 snapshot을 전달한다.
3. key/range/actor별로 partition하여 단일 소유권을 준다.
4. message passing이나 channel로 mutation을 한 곳에 모은다.
5. 불가피한 공유 부분만 synchronization한다.

lock을 선택할 때 보호하는 invariant와 함께 유지해야 할 field를 명시한다. lock이 변수 하나가 아니라 여러 상태의 일관성을 보호한다면 그 전체를 같은 critical section에서 처리한다.

- critical section을 작게 유지하되 atomic operation을 억지로 쪼개지 않는다.
- lock 획득 순서를 일관되게 하고 nested lock과 callback-under-lock을 피한다.
- synchronize된 여러 method를 호출하는 compound action이 자동으로 atomic하다고 가정하지 않는다.
- lock-free primitive와 atomic type도 memory ordering과 ABA 같은 계약을 이해할 때만 사용한다.
- 언어와 platform이 제공하는 검증된 queue, pool, future, structured concurrency primitive를 우선한다.
- 직접 mutex·scheduler를 구현하기 전에 표준 library가 필요한 보장을 제공하는지 확인한다.

## 5. 자원과 공정성을 제한한다

동시성 문제는 데이터 race뿐 아니라 resource exhaustion도 포함한다.

- thread, task, connection, file descriptor, queue와 in-flight request에 상한을 둔다.
- producer가 consumer보다 빠를 때 block, drop, batch, spill, reject 중 어떤 정책을 쓰는지 명시한다.
- 우선순위가 낮은 작업이 영구히 실행되지 않는 starvation 가능성을 본다.
- 재시도와 fan-out이 곱해져 thundering herd를 만드는지 확인한다.
- timeout 뒤 작업이 실제 취소되는지, background에서 effect를 계속 남기는지 본다.
- semaphore와 pool permit이 예외·취소 모든 경로에서 반환되는지 확인한다.

성능 최적화는 실제 부하, queue depth, contention, tail latency와 resource 사용을 측정해 판단한다.

## 6. startup, cancellation과 shutdown을 설계한다

종료 코드는 정상 처리만큼 중요하다.

- 새 작업 수락 중지, 진행 중 작업 처리 또는 취소, queue drain, resource close, 종료 대기의 순서를 정한다.
- signal과 cancellation이 모든 blocking point에 전달되는지 확인한다.
- shutdown이 timeout되면 강제 종료와 데이터 손실 정책을 명시한다.
- initialization 실패 중 일부 resource만 생성되었을 때 cleanup을 확인한다.
- daemon/background task가 process 종료를 막거나 조용히 사라지지 않게 한다.
- test teardown이 production shutdown path를 사용하게 해 lifecycle 결함을 노출한다.

startup/shutdown을 단순한 boilerplate로 취급하지 않는다. deadlock과 부분 실패가 자주 숨어 있는 독립 workflow다.

## 7. 드문 실패를 실제 결함으로 취급한다

한 번만 발생한 test failure나 운영 race를 환경 탓으로 지우지 않는다.

- 실패 시 task/thread ID, state transition, queue와 lock 관련 최소 진단 정보를 수집한다.
- deterministic scheduler, virtual clock, barrier, latch, seeded stress, repeated execution으로 interleaving을 변화시킨다.
- production code에 무작위 sleep을 넣어 race를 “고치지” 않는다.
- test가 timing에 기대지 않도록 명시적 synchronization point를 사용한다.
- 재현이 안 되면 사라졌다고 단정하지 말고 알려진 조건과 관찰 범위를 기록한다.

실패를 노출하기 위한 yield·지연·실행 순서 교란 기법은 test harness나 진단 모드에서 사용하고 production semantics를 바꾸지 않는다.

## 8. 동시성 테스트를 계층화한다

- 순수 policy와 state transition은 빠른 deterministic unit test로 검증한다.
- synchronization wrapper는 atomicity, ordering, cancellation, timeout을 표적 테스트한다.
- 실제 executor/runtime에서는 여러 thread 수, queue 크기, core 수와 load를 바꿔 본다.
- repeated/stress test는 횟수, seed, 환경과 실패 artifact를 남긴다.
- liveness test는 완료 상한과 진단 dump를 두되 단순 sleep 후 “아마 끝났음”으로 확인하지 않는다.
- race detector, sanitizer, deadlock detector가 언어에 있으면 승인된 환경에서 사용한다.
- 테스트 통과가 가능한 모든 interleaving의 증명은 아니다. 고위험 invariant에는 설계 수준의 단순화와 별도 검토가 필요하다.

## 9. 리뷰와 변경 절차

1. 한 공유 invariant나 lifecycle 경로를 끝까지 추적한다.
2. 실제 race, atomicity, liveness 또는 resource contract를 문장으로 적는다.
3. immutable/copy/partition/sequential 대안부터 비교한다.
4. 가장 좁은 synchronization 또는 ownership 변경을 적용한다.
5. business behavior 변경과 concurrency mechanism 변경을 분리한다.
6. 단위, 반복, stress와 shutdown test를 위험에 맞춰 실행한다.
7. 성능 목적이었다면 변경 전후 같은 workload로 측정한다.
8. final diff에서 새 unbounded queue, leaked task, swallowed cancellation과 nested lock을 다시 본다.

## 결과

“race 가능성”만 말하지 말고 충돌하는 두 경로, 공유 상태, 필요한 interleaving, 영향과 현재 safeguard를 제시한다. 수정했다면 ownership 모델, synchronization 범위, 종료 계약, 실행한 반복·stress 조건과 남은 비결정성을 보고한다.
