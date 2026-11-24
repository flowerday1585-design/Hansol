(() => {
  "use strict";
  const pausedMessage = "현재 결제 계약과 국내 배송 안내를 정비 중이어서 주문이 일시 중지되었습니다.";
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
    ["orderCustoms", "signupCustoms"].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.value = "";
      input.disabled = true;
      input.closest(".form-group")?.setAttribute("hidden", "");
    });
    const checkoutTitle = document.getElementById("checkoutTitle");
    if (checkoutTitle) checkoutTitle.textContent = "주문 안내";
    const checkoutNotice = document.querySelector("#checkoutForm .order-message");
    if (checkoutNotice) checkoutNotice.textContent = pausedMessage;
    const checkoutBank = document.getElementById("checkoutBank");
    if (checkoutBank) {
      checkoutBank.textContent = "";
      checkoutBank.hidden = true;
    }
    document.querySelectorAll("#footerPolicies button").forEach(button => {
      const title = button.textContent.replace(/\\s/g, "");
      if (title === "관세및수입세" || title === "결제방법") button.remove();
    });
    const bannerDescription = document.getElementById("bannerDescription");
    if (bannerDescription) bannerDescription.textContent = "일본에서 직접 수입·통관한 정품 카드 상품을 국내에서 안전하게 발송합니다.";
    const vatDescription = document.getElementById("vatDescription");
    if (vatDescription) vatDescription.textContent = "모든 표시 가격은 부가가치세가 포함된 최종 소비자 가격입니다.";
    const checkoutItems = document.getElementById("checkoutItems");
    const cleanVatSummary = () => {
      if (!checkoutItems || !checkoutItems.textContent.includes("VAT 별도")) return;
      checkoutItems.textContent = checkoutItems.textContent.replace(/VAT 별도[^·\\n]+ · 부가세 [^\\n]+/g, "부가세 포함");
    };
    cleanVatSummary();
    if (checkoutItems) new MutationObserver(cleanVatSummary).observe(checkoutItems, {childList:true,subtree:true,characterData:true});
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
  document.addEventListener("input", event => {
    if (!["orderCustoms", "signupCustoms"].includes(event.target?.id)) return;
    event.target.value = "";
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
          marketing_agreed_at: marketing?.checked ? agreedAt : null,
          shop_customs: ""
        });
      };
    }
  }
})();
