(() => {
  "use strict";
  const pausedMessage = "현재 결제 계약 심사와 주문 전 배송비 표시를 준비 중입니다. 주문은 일시 중지 상태이며 개인 계좌로 송금하지 마세요.";
  const controls = '[data-click="checkout-product"], [data-click="start-checkout"], #detailOrder';
  const lockPurchases = () => {
    document.querySelectorAll(controls).forEach(button => {
      if (!button.disabled || button.textContent !== "판매 준비 중" || button.getAttribute("aria-disabled") !== "true") {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
        button.title = pausedMessage;
        button.textContent = "판매 준비 중";
      }
    });
    document.querySelectorAll('[data-click="open-bank-settings"]').forEach(button => button.remove());
    const bankModal = document.getElementById("bankModal");
    if (bankModal) bankModal.hidden = true;
  };
  document.addEventListener("click", event => {
    const button = event.target.closest?.(controls);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.alert(pausedMessage);
  }, true);
  document.addEventListener("submit", event => {
    if (event.target?.id !== "checkoutForm") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.alert(pausedMessage);
  }, true);
  lockPurchases();
  new MutationObserver(lockPurchases).observe(document.documentElement, {childList:true,subtree:true});

  const terms = document.getElementById("signupTerms");
  const privacy = document.getElementById("signupPrivacy");
  const marketing = document.getElementById("signupMarketing");
  if (terms && privacy) {
    terms.required = true;
    privacy.required = true;
    document.addEventListener("click", event => {
      const action = event.target.closest?.('[data-click="handle-signup"], [data-click="handle-signup-true"]');
      if (!action || (terms.checked && privacy.checked)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const status = document.getElementById("signupStatus");
      if (status) status.textContent = "회원가입을 계속하려면 이용약관과 개인정보 수집·이용에 필수 동의해 주세요.";
      (!terms.checked ? terms : privacy).focus();
    }, true);
    const originalSignup = window.hansolCatalog?.signup;
    if (typeof originalSignup === "function") {
      window.hansolCatalog.signup = function(email, password, profile) {
        if (!terms.checked || !privacy.checked) throw new Error("필수 동의가 필요합니다.");
        const agreedAt = new Date().toISOString();
        return originalSignup.call(this, email, password, {
          ...profile,
          terms_agreed_at: agreedAt,
          privacy_agreed_at: agreedAt,
          marketing_agreed: Boolean(marketing?.checked),
          marketing_agreed_at: marketing?.checked ? agreedAt : null
        });
      };
    }
  }
})();
