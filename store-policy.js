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
    ["terms","이용약관",[
      "한솔아카이브 이용약관",
      "시행일: 2026년 11월 25일",
      "",
      "1. 운영자와 서비스",
      "이 약관은 한솔에너지(쇼핑몰명 한솔아카이브, 대표자 조영래)가 운영하는 hansolarchive.com의 이용 및 상품 거래에 적용됩니다. 현재 판매 방식은 일본에서 수입·통관한 상품을 국내에서 판매하는 것입니다. 해외 구매대행·해외 직배송 및 개인통관고유부호 수집은 제공하지 않습니다.",
      "",
      "2. 회원가입과 계정",
      "회원은 정확한 정보를 제공하고 계정정보를 안전하게 관리해야 합니다. 현재 회원가입은 만 15세 이상으로 제한됩니다. 이용약관과 개인정보 처리방침 동의는 필수이며 마케팅 수신 동의는 선택입니다. 회원은 고객센터에 탈퇴를 요청할 수 있습니다. 다만 법령상 보존이 필요한 거래기록은 정해진 기간 별도 보관할 수 있습니다.",
      "",
      "3. 상품과 가격",
      "상품 구성, 언어, 상태, 재고 및 발송 안내는 각 상품 페이지에 표시합니다. 표시 가격은 부가가치세 포함 금액입니다. 상품 사진은 촬영 환경에 따라 실제 색상과 다르게 보일 수 있으며 중요한 구성 차이는 상품 설명으로 안내합니다.",
      "",
      "4. 주문과 결제",
      "현재 결제 계약과 국내 배송 안내를 정비 중이므로 온라인 주문 접수와 결제가 일시 중단되어 있습니다. 장바구니 담기는 주문이나 구매 계약이 아닙니다. 주문 재개 후에는 최종 상품, 수량, 배송비, 결제 수단과 총액을 주문 화면에 표시합니다. 결제 계약 및 승인이 확인된 결제 수단만 사용합니다.",
      "",
      "5. 배송",
      "주문 재개 시 상품별 배송 예정일, 배송비 및 적용 조건을 주문 전에 표시합니다. 입고·택배 상황으로 일정이 달라지면 등록된 연락처로 안내합니다. 상품 공급이 불가능해진 경우 지체 없이 알리고 이미 받은 대금은 법정 기한에 환급합니다.",
      "",
      "6. 청약철회와 환급",
      "소비자는 관계 법령이 정한 기간과 요건에 따라 청약철회할 수 있습니다. 일반적으로 법에서 정한 계약서면 또는 상품을 받은 날부터 7일 이내이며, 표시·광고 또는 계약 내용과 다른 경우에는 공급받은 날부터 3개월 이내 또는 그 사실을 안 날부터 30일 이내에 요청할 수 있습니다. 법률상 제한 사유가 적용되는 경우에도 하자·오배송 등 법정 권리는 보장됩니다. 자세한 사항은 ‘반품·교환·환불 정책’을 따릅니다.",
      "",
      "7. 지식재산과 게시물",
      "이용자는 타인의 권리를 침해하는 내용을 게시할 수 없습니다. 상품명, 상표, 카드 이미지 및 저작물의 권리는 각 권리자에게 있으며 허가 없이 복제·배포할 수 없습니다.",
      "",
      "8. 개인정보와 분쟁",
      "개인정보 처리는 별도의 개인정보 처리방침에 따릅니다. 이 약관은 대한민국 법령에 따릅니다. 소비자 분쟁은 관계 법령과 소비자 분쟁 해결 기준을 따릅니다.",
      "",
      "운영자: 한솔에너지 | 대표자: 조영래",
      "고객센터: 010-2820-9250 | flowerday1585@naver.com"
    ].join("\n")],
    ["privacy","개인정보 처리방침",[
      "한솔아카이브 개인정보 처리방침",
      "시행일: 2026년 11월 25일",
      "",
      "1. 개인정보처리자와 문의",
      "한솔에너지(쇼핑몰명 한솔아카이브, 대표자 조영래)가 hansolarchive.com을 운영합니다. 개인정보 보호 문의: 010-2820-9250, flowerday1585@naver.com.",
      "",
      "2. 처리 목적과 항목",
      "• 회원 가입·인증·계정관리: 이메일, 비밀번호 인증정보, 한글 이름, 휴대전화번호, 카카오톡 아이디, 한글·영문 배송주소, 도시, 우편번호, 필수 약관 동의 및 만 15세 이상 확인 기록. 영문 이름과 마케팅 수신 동의는 선택 항목입니다.",
      "• 주문·배송·취소·환불: 주문 상품·수량·금액, 수취인·연락처·배송주소, 주문·결제 상태, 운송장 및 관련 문의. 주문 기능 재개 후 거래에 필요한 정보를 처리합니다.",
      "• 고객 문의·보안: 문의 내용과 회신 연락처, 접속·오류·보안 기록, 로그인 세션과 장바구니를 위한 브라우저 저장 정보.",
      "현재 온라인 주문과 결제가 중단되어 결제정보를 수집하지 않습니다. 개인통관고유부호는 신규 수집하지 않으며 사이트에서 비활성화되어 저장되지 않습니다.",
      "",
      "3. 보유 기간과 파기",
      "회원 정보는 탈퇴 시 지체 없이 파기합니다. 단, 전자상거래법상 기록은 분리하여 보관합니다: 표시·광고 6개월, 계약·청약철회 및 대금결제·재화 공급 5년, 소비자 불만·분쟁처리 3년. 법정 보존기간 또는 처리 목적이 끝난 정보는 복구할 수 없도록 삭제합니다.",
      "",
      "4. 처리 위탁 및 외부 서비스",
      "• Supabase, Inc. (일본 도쿄 리전): 회원 인증, 회원·상품·주문 정보의 저장·처리.",
      "• Resend, Inc. (미국): 회원 인증 및 운영 이메일 발송. 이메일 주소와 메일 내용은 발송 시 이전됩니다.",
      "• 카카오 (대한민국): 가입 주소 검색 기능. 검색을 이용하면 주소 검색에 필요한 정보와 접속·기기 정보가 처리될 수 있으며 직접 입력도 가능합니다.",
      "• 배송업체: 주문 재개 후 배송에 필요한 수취인, 연락처, 주소 및 운송장 정보.",
      "현재 결제대행사로 결제정보를 전달하지 않습니다. 결제 서비스가 승인되어 실제 연동될 경우 처리 업체와 항목을 확인해 이 방침을 갱신합니다.",
      "",
      "5. 개인정보 국외 이전",
      "Supabase, Inc.의 도쿄(일본) 리전에서 이메일, 계정 프로필과 서비스 운영 정보가 처리·보관될 수 있습니다. Resend, Inc.(미국)로 인증·운영 이메일 발송에 필요한 이메일 주소와 메일 내용이 전송될 수 있습니다. 이전 시점은 가입·로그인·이메일 발송 또는 서비스 이용 시이며 인터넷을 통해 전송됩니다. 목적은 계정·사이트 운영 및 안내 이메일 발송입니다. 정보주체는 고객센터로 국외 이전 관련 문의와 권리 행사를 할 수 있습니다. 이전을 거부하면 회원 인증 또는 이메일 안내 이용이 제한될 수 있습니다.",
      "",
      "6. 이용자의 권리",
      "본인 개인정보의 열람·정정·삭제·처리정지와 동의 철회를 요청할 수 있습니다. 회원 탈퇴 및 마케팅 수신 동의 철회는 고객센터에 이메일 또는 전화로 요청해 주세요. 법정 보존 정보는 기간 종료 후 삭제합니다.",
      "",
      "7. 쿠키와 브라우저 저장",
      "로그인 상태와 장바구니 등 기본 기능을 위해 브라우저 저장공간을 사용할 수 있습니다. 환율·시장 시세 위젯과 주소 검색을 불러오면 해당 외부 제공자에게 IP, 브라우저·기기 정보가 전달될 수 있고 각 제공자의 개인정보 처리방침이 적용됩니다. 광고성 마케팅은 별도 선택 동의가 있는 경우에만 발송합니다. 브라우저에서 저장정보를 관리하거나 차단할 수 있으나 일부 기능이 제한될 수 있습니다.",
      "",
      "개인정보 보호 문의 담당: 한솔에너지 대표자 조영래",
      "전화: 010-2820-9250 | 이메일: flowerday1585@naver.com"
    ].join("\n")],
    ["returns","반품·교환·환불 정책",[
      "한솔아카이브 반품·교환·환불 정책",
      "시행일: 2026년 11월 25일",
      "",
      "현재 온라인 주문과 결제는 일시 중단되어 있습니다. 아래 기준은 기존 거래와 주문 기능 재개 후 거래에 적용합니다.",
      "",
      "1. 단순 변심",
      "관계 법령이 정한 기준일부터 7일 이내 청약철회를 신청할 수 있습니다. 단순 변심의 반환 배송비는 소비자가 부담합니다. 최초 배송비가 무료였더라도 실제 발생하는 왕복 배송비가 적용될 수 있으며 접수 시 비용과 방법을 안내합니다.",
      "",
      "2. 하자·오배송·표시 내용과 다름",
      "상품이 표시·광고 또는 계약 내용과 다르거나 판매자 귀책의 하자·오배송이 있으면 공급받은 날부터 3개월 이내 또는 그 사실을 안 날부터 30일 이내에 청약철회 등을 요청할 수 있습니다. 이 경우 반환 배송비는 판매자가 부담합니다.",
      "",
      "3. 밀봉 카드 상품",
      "포장을 개봉하거나 구성품을 사용해 상품 가치가 현저히 감소한 경우, 법령상 요건과 사전 고지가 갖춰진 범위에서 청약철회가 제한될 수 있습니다. 포장 훼손만으로 모든 법적 권리가 자동 소멸하는 것은 아니며 하자·오배송 등 법정 권리는 유지됩니다.",
      "",
      "4. 접수와 회수",
      "주문번호, 성함, 연락처와 사유를 010-2820-9250 또는 flowerday1585@naver.com으로 보내 주세요. 먼저 접수해 회수 방법을 안내받은 뒤 상품을 보내 주세요. 반송 주소는 접수 후 개별 안내합니다.",
      "",
      "5. 환불과 교환",
      "청약철회가 확인되고 반환 상품을 받은 뒤 법정 기한인 3영업일 이내에 대금을 환급합니다. 카드 결제는 해당 결제수단의 취소 절차로 진행하며 금융기관의 반영 시점은 다를 수 있습니다. 교환은 같은 상품의 재고가 있는 경우 진행합니다. 판매자 귀책의 회수·환급 비용은 판매자가 부담합니다.",
      "",
      "분쟁 상담: 1372 소비자상담센터 | 고객센터: 010-2820-9250"
    ].join("\n")],
    ["shipping","배송 정책",[
      "한솔아카이브 배송 정책",
      "시행일: 2026년 11월 25일",
      "",
      "1. 현재 상태",
      "결제 계약과 국내 배송 안내 정비를 위해 온라인 주문과 결제를 일시 중단했습니다. 주문 기능 재개 전에는 상품을 주문하거나 결제할 수 없습니다.",
      "",
      "2. 판매·배송 범위",
      "일본에서 수입·통관한 상품을 국내에서 판매하고 국내 주소로 발송합니다. 해외 구매대행, 해외 직배송, 별도 관세·수입세 청구 및 개인통관고유부호 신규 수집은 제공하지 않습니다.",
      "",
      "3. 배송비와 일정",
      "주문 재개 후 배송비, 무료배송 조건이 있다면 그 기준, 도서산간 추가비용 및 상품별 발송 예정일을 주문 전에 표시합니다. 예약·입고 상품은 상세 페이지의 일정을 확인해 주세요. 지연이나 변경이 생기면 등록된 연락처로 안내합니다.",
      "",
      "4. 배송지와 조회",
      "주문자는 정확한 수취인·연락처·주소를 입력해야 합니다. 발송 뒤 운송장 번호와 조회 방법을 제공합니다. 주소 오류, 수취 불가, 배송 중 분실·파손 문제가 있으면 포장 상태를 보관하고 고객센터로 연락해 주세요. 판매자는 택배사와 확인해 관계 법령에 따른 조치를 안내합니다.",
      "",
      "고객센터: 010-2820-9250 | flowerday1585@naver.com"
    ].join("\n")],
    ["business","고객센터 및 사업자 정보",[
      "고객센터 및 사업자 정보",
      "시행일: 2026년 11월 25일",
      "",
      "상호: 한솔에너지",
      "쇼핑몰명: 한솔아카이브",
      "대표자: 조영래",
      "사업자등록번호: 170-22-01601",
      "통신판매업 신고번호: 2026-부산북구-0592",
      "사업장 주소: 부산광역시 북구 효열로220번길 23",
      "고객센터 전화: 010-2820-9250",
      "고객센터 이메일: flowerday1585@naver.com",
      "홈페이지: https://hansolarchive.com/",
      "호스팅 서비스 제공자: GitHub, Inc. (GitHub Pages)",
      "표시 가격: 부가가치세 포함",
      "",
      "개인정보 보호, 회원 탈퇴, 주문·배송·교환·반품·환불 문의를 위 연락처로 접수해 주세요. 주소 상세 동·호수는 공개하지 않습니다. 반품이 필요한 경우 접수 후 안전한 회수 방법과 반송 주소를 개별 안내합니다.",
      "",
      "통신판매사업자 정보는 홈페이지 하단 ‘사업자 정보 확인’ 링크에서 공정거래위원회에 조회할 수 있습니다."
    ].join("\n")],
    ["legal","법적 고지",[
      "법적 고지",
      "시행일: 2026년 11월 25일",
      "",
      "이 홈페이지는 한솔에너지(대표자 조영래)가 운영하는 한솔아카이브 쇼핑몰입니다. 사업자 정보와 통신판매업 신고 정보는 홈페이지 하단 및 ‘고객센터 및 사업자 정보’에서 확인할 수 있고 공정거래위원회 사업자정보 공개 페이지로 연결됩니다.",
      "",
      "표시 가격은 부가가치세를 포함합니다. 상품 구성, 언어, 상태, 재고와 발송 안내는 각 상품 상세 페이지를 기준으로 합니다. 현재 결제 계약과 국내 배송 안내 정비를 위해 온라인 주문과 결제를 일시 중단했습니다.",
      "",
      "포켓몬, 원피스 및 각 게임·캐릭터·상표의 명칭과 저작권·상표권은 각 권리자에게 있습니다. 이 사이트는 상품 식별과 판매 안내에 필요한 범위에서 해당 명칭을 사용하며 권리자의 공식 서비스 또는 제휴사로 오인될 표시를 하지 않습니다.",
      "",
      "콘텐츠의 무단 복제·배포를 금합니다. 권리 침해 신고 및 소비자 문의: flowerday1585@naver.com.",
      "분쟁 해결은 대한민국 관계 법령과 소비자 분쟁 해결 기준을 따릅니다."
    ].join("\n")],
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

  function setFooterBusiness() {
    const rows = document.querySelectorAll(".footer-business");
    if (rows[0]) rows[0].textContent = "상호: 한솔에너지 · 쇼핑몰명: 한솔아카이브 · 대표자: 조영래 · 사업자등록번호: 170-22-01601";
    if (rows[1]) {
      rows[1].replaceChildren(document.createTextNode("통신판매업 신고번호: 2026-부산북구-0592 · 사업장 주소: 부산광역시 북구 효열로220번길 23 · 호스팅: GitHub, Inc. · 가격: 부가세 포함 · "));
      const link = document.createElement("a");
      link.href = "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=1702201601";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "사업자 정보 확인";
      rows[1].append(link);
    }
    const contact = document.querySelector(".footer-contact");
    if (contact) {
      contact.replaceChildren(document.createTextNode("고객센터 "));
      const phone = document.createElement("a");
      phone.href = "tel:010-2820-9250";
      phone.textContent = "010-2820-9250";
      const email = document.createElement("a");
      email.href = "mailto:flowerday1585@naver.com";
      email.textContent = "flowerday1585@naver.com";
      contact.append(phone, document.createTextNode(" · 이메일 "), email);
    }
  }

  function addStyles() {
    if (document.getElementById("hansolPolicyStyles")) return;
    const style = document.createElement("style");
    style.id = "hansolPolicyStyles";
    style.textContent = "#policyModal .modal-content{width:min(94vw,820px);max-width:820px;max-height:94dvh;padding:24px}#policyText{max-height:calc(94dvh - 180px);overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.75;color:#111827}.footer-business,.footer-contact{line-height:1.7;overflow-wrap:anywhere}.footer-business a,.footer-contact a{color:#e7d8bc;text-decoration:underline;text-underline-offset:2px}@media(max-width:640px){#policyModal{align-items:flex-end;padding:8px}#policyModal .modal-content{width:100%;max-width:none;max-height:94dvh;padding:18px;border-radius:14px 14px 8px 8px}#policyText{max-height:calc(94dvh - 160px);font-size:15px;line-height:1.7}#footerPolicies{gap:2px 12px}#footerPolicies button{min-height:40px}}";
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

  function renderPages() {
    const nav = document.getElementById("footerPolicies");
    if (!nav) return;
    nav.replaceChildren();
    pages.forEach(page => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = page[1];
      button.dataset.policyKey = page[0];
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openPage(page);
      });
      nav.append(button);
    });
    addStyles();
    setFooterBusiness();
  }

  renderPages();
})();