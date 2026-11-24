const form = document.querySelector("form");
const key = document.getElementById("client-key");
const status = document.getElementById("preview-status");
const submit = form.querySelector("button");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  const clientKey = key.value.trim();
  if (!/^test_gck_[A-Za-z0-9_]+$/.test(clientKey)) {
    status.textContent = "test_gck_로 시작하는 테스트 클라이언트 키를 입력해 주세요.";
    return;
  }
  submit.disabled = true;
  status.textContent = "테스트 위젯을 불러오는 중입니다.";
  try {
    const toss = window.TossPayments(clientKey);
    const widgets = toss.widgets({ customerKey: window.TossPayments.ANONYMOUS });
    await widgets.setAmount({ currency: "KRW", value: 1000 });
    await widgets.renderPaymentMethods({ selector: "#payment-methods" });
    await widgets.renderAgreement({ selector: "#agreement" });
    status.textContent = "테스트 위젯이 표시되었습니다.";
    key.disabled = true;
  } catch {
    document.getElementById("payment-methods").replaceChildren();
    document.getElementById("agreement").replaceChildren();
    status.textContent = "위젯을 표시하지 못했습니다. 테스트 키와 상점의 결제 UI 설정을 확인해 주세요.";
    submit.disabled = false;
  }
});
