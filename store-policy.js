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
    if (checkoutTitle && checkoutTitle.textContent !== "주문 안내") checkoutTitle.textContent = "주문 안내";
    const checkoutNotice = document.querySelector("#checkoutForm .order-message");
    if (checkoutNotice && checkoutNotice.textContent !== pausedMessage) checkoutNotice.textContent = pausedMessage;
    const checkoutBank = document.getElementById("checkoutBank");
    if (checkoutBank) {
      if (checkoutBank.textContent) checkoutBank.textContent = "";
      if (!checkoutBank.hidden) checkoutBank.hidden = true;
    }
    document.querySelectorAll("#footerPolicies button").forEach(button => {
      const title = button.textContent.replace(/\s/g, "");
      if (title === "관세및수입세" || title === "결제방법") {
        button.remove();
      } else if (["개인정보보호관련선택사항", "서비스약관", "반품및환불정책", "개인정보보호정책", "법적고지", "배송정책"].includes(title)) {
        button.hidden = document.getElementById("bannerEditButton")?.hidden !== false;
      }
    });
    const bannerDescription = document.getElementById("bannerDescription");
    if (bannerDescription && bannerDescription.textContent !== "일본에서 직접 수입·통관한 정품 카드 상품을 국내에서 안전하게 발송합니다.") bannerDescription.textContent = "일본에서 직접 수입·통관한 정품 카드 상품을 국내에서 안전하게 발송합니다.";
    const vatDescription = document.getElementById("vatDescription");
    if (vatDescription && vatDescription.textContent !== "모든 표시 가격은 부가가치세가 포함된 최종 소비자 가격입니다.") vatDescription.textContent = "모든 표시 가격은 부가가치세가 포함된 최종 소비자 가격입니다.";
  };
  const checkoutItems = document.getElementById("checkoutItems");
  if (checkoutItems) {
    const cleanVatSummary = () => {
      if (!checkoutItems.textContent.includes("VAT 별도")) return;
      checkoutItems.textContent = checkoutItems.textContent.split("\n").map(line => line.startsWith("VAT 별도") ? "부가세 포함" : line).join("\n");
    };
    cleanVatSummary();
    new MutationObserver(cleanVatSummary).observe(checkoutItems, {childList:true,subtree:true,characterData:true});
  }
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
      if (event.target.closest?.('[data-click="close-modal-signup-modal"]')) {
        terms.checked = privacy.checked = marketing.checked = false;
        return;
      }
      const action = event.target.closest?.('[data-click="handle-signup"]');
      if (!action || (terms.checked && privacy.checked)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const status = document.getElementById("signupStatus");
      if (status) status.textContent = "회원가입을 계속하려면 이용약관과 개인정보 수집·이용에 필수 동의해 주세요.";
      (!terms.checked ? terms : privacy).focus();
    }, true);
    const originalSignup = window.hansolCatalog?.signup;
    if (typeof originalSignup === "function") {
      window.hansolCatalog.signup = async function(email, password, profile) {
        if (!terms.checked || !privacy.checked) throw new Error("필수 동의가 필요합니다.");
        const agreedAt = new Date().toISOString();
        const account = await originalSignup.call(this, email, password, {
          ...profile,
          agreement_version: "2026-11-24",
          terms_agreed_at: agreedAt,
          privacy_agreed_at: agreedAt,
          marketing_agreed: Boolean(marketing?.checked),
          marketing_agreed_at: marketing?.checked ? agreedAt : null,
          shop_customs: ""
        });
        terms.checked = privacy.checked = marketing.checked = false;
        return account;
      };
    }
  }
})();

(() => {
  "use strict";
  const pages = [
    ["faq","자주 묻는 질문",[
      "자주 묻는 질문",
      "시행일: 2026년 11월 25일",
      "",
      "Q. 지금 주문하거나 결제할 수 있나요?",
      "A. 현재 결제 계약과 국내 배송 안내 정비 중이라 주문과 결제를 일시 중단했습니다. 장바구니에 담아도 주문이 완료되지 않습니다.",
      "",
      "Q. 어떤 상품을 판매하나요?",
      "A. 일본에서 수입·통관한 포켓몬·원피스 TCG 상품과 보관용품을 국내에서 판매합니다. 언어·구성·상태는 상품 상세 페이지를 확인해 주세요.",
      "",
      "Q. 표시 가격에 부가세가 포함되어 있나요?",
      "A. 네. 표시가격은 부가가치세 포함 가격입니다. 현재 구매대행이나 별도 관세·수입세 청구 서비스를 제공하지 않습니다.",
      "",
      "Q. 언제 배송되나요?",
      "A. 현재 주문을 받지 않습니다. 주문 재개 후 상품별 발송 예정일과 배송비를 상품·주문 화면에 표시합니다.",
      "",
      "Q. 반품이나 환불은 어떻게 신청하나요?",
      "A. 주문번호, 성함, 연락처와 사유를 010-2820-9250 또는 flowerday1585@naver.com으로 보내 주세요. 먼저 접수하고 안내받은 회수 방법을 이용해 주세요.",
      "",
      "Q. 개인통관고유부호를 제출해야 하나요?",
      "A. 현재 국내 판매만 안내하며 개인통관고유부호를 새로 수집하지 않습니다.",
      "",
      "Q. 개인정보 열람·정정·탈퇴는 어디에 요청하나요?",
      "A. flowerday1585@naver.com 또는 010-2820-9250으로 요청해 주세요. 법정 보존이 필요한 거래 기록은 정해진 기간 별도 보관합니다.",
      "",
      "Q. 고객센터 운영 시간은 어떻게 되나요?",
      "A. 이메일 또는 전화로 문의를 보내 주시면 확인 후 순서대로 회신합니다."
    ].join("\n")],
    ["about","회사 소개",[
      "한솔아카이브 소개",
      "시행일: 2026년 11월 25일",
      "",
      "한솔아카이브는 한솔에너지가 운영하는 일본판 포켓몬·원피스 트레이딩 카드 전문 쇼핑몰입니다. 일본에서 수입·통관한 정품 카드 상품과 보관용품을 국내 고객에게 소개하고 국내에서 발송합니다.",
      "",
      "상품의 언어, 구성, 상태와 배송 안내를 확인할 수 있도록 상품별 정보를 제공하고 문의와 거래를 책임 있게 처리하는 것을 운영 기준으로 삼습니다. 표시 가격은 부가가치세 포함 가격입니다.",
      "",
      "현재 결제 계약과 국내 배송 안내를 정비하기 위해 온라인 주문과 결제를 일시 중단했습니다. 필요한 계약과 승인이 확인된 뒤에만 주문 기능을 재개합니다.",
      "",
      "운영자: 한솔에너지",
      "고객센터: 010-2820-9250 | flowerday1585@naver.com",
      "사업장: 부산광역시 북구 효열로220번길 23"
    ].join("\n")]
  ];
  function addStyles() {
    if (document.getElementById("hansolPolicyStyles")) return;
    const style = document.createElement("style");
    style.id = "hansolPolicyStyles";
    style.textContent = "#policyModal .modal-content{width:min(94vw,820px);max-width:820px;max-height:94dvh;padding:24px}#policyText{max-height:calc(94dvh - 180px);overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.75;color:#111827}.footer-business,.footer-contact{line-height:1.7;overflow-wrap:anywhere}.footer-business a,.footer-contact a{color:#e7d8bc;text-decoration:underline;text-underline-offset:2px}@media(max-width:640px){#policyModal{align-items:flex-end;padding:8px}#policyModal .modal-content{width:100%;max-width:none;max-height:94dvh;padding:18px;border-radius:14px 14px 8px 8px}#policyText{max-height:calc(94dvh - 160px);font-size:15px;line-height:1.7}#footerPolicies{gap:2px 12px}#footerPolicies button,#footerPolicies a{min-height:40px}#footerPolicies a{color:#d7cbbb;padding:7px 0;text-decoration:none;font:inherit}#footerPolicies a:hover,#footerPolicies a:focus-visible{text-decoration:underline}}";
    document.head.append(style);
  }

  function openPage(page) {
    const modal = document.getElementById("policyModal");
    const title = document.getElementById("policyTitle");
    const text = document.getElementById("policyText");
    if (!modal || !title || !text) return;
    title.textContent = page[1];
    text.textContent = page[2];
    const admin = document.getElementById("policyAdmin");
    if (admin) admin.hidden = true;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    text.scrollTop = 0;
    modal.querySelector('[data-click="close-modal-policy-modal"]')?.focus();
  }


  const nav = document.getElementById("footerPolicies");
  nav?.addEventListener("click", event => {
    const button = event.target.closest?.("button");
    const page = pages.find(entry => entry[1] === button?.textContent);
    if (!page || document.getElementById("bannerEditButton")?.hidden === false) return;
    event.stopPropagation();
    openPage(page);
  }, true);
  addStyles();
  if (nav) {
    nav.setAttribute("aria-label","정책 및 이용 안내");
    nav.replaceChildren();
    [
      ["이용약관","terms"],
      ["개인정보 처리방침","privacy"],
      ["반품·교환·환불 정책","returns"],
      ["배송 정책","shipping"],
      ["고객센터 및 사업자 정보","contact"],
      ["법적 고지","legal"],
      ["자주 묻는 질문","faq"],
      ["회사 소개","about"]
    ].forEach(([label,anchor]) => {
      const link = document.createElement("a");
      link.href = "/legal.html#" + anchor;
      link.textContent = label;
      nav.append(link);
    });
  }
