import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.width = "2em";
      textarea.style.height = "2em";
      textarea.style.padding = "0";
      textarea.style.border = "none";
      textarea.style.outline = "none";
      textarea.style.boxShadow = "none";
      textarea.style.background = "transparent";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (successful) {
        resolve();
      } else {
        reject(new Error("Fallback copy command failed"));
      }
    } catch (err) {
      reject(err);
    }
  });
}

export function useCopyClipboard() {
  const location = useLocation();

  useEffect(() => {
    const attachButtons = () => {
      const codePres = document.querySelectorAll("pre.guide-code-pre:not([data-gocodeblock])");

      codePres.forEach((pre) => {
        if (pre.dataset.hasCopyButton) return;
        pre.dataset.hasCopyButton = "true";

        // Create copy button
        const button = document.createElement("button");
        button.className = "guide-copy-code-btn";
        button.innerHTML = `
          <svg class="guide-copy-code-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        `;

        // Handle click event
        button.addEventListener("click", (e) => {
          e.stopPropagation();

          let codeText = "";
          const codeEl = pre.querySelector("code");
          if (codeEl) {
            codeText = codeEl.innerText || codeEl.textContent || "";
          } else {
            const cloned = pre.cloneNode(true);
            const btn = cloned.querySelector(".guide-copy-code-btn");
            if (btn) btn.remove();
            codeText = cloned.innerText || cloned.textContent || "";
          }

          // Clean up carriage returns or extra newlines that may break shell/copy
          const cleanCode = codeText.replace(/\r\n/g, "\n").trim();

          copyTextToClipboard(cleanCode).then(() => {
            button.classList.add("copied");
            button.querySelector("span").textContent = "Copied!";
            const originalSvg = button.querySelector("svg").innerHTML;
            button.querySelector("svg").innerHTML = `
              <polyline points="20 6 9 17 4 12"></polyline>
            `;

            setTimeout(() => {
              button.classList.remove("copied");
              button.querySelector("span").textContent = "Copy";
              button.querySelector("svg").innerHTML = originalSvg;
            }, 2000);
          }).catch(err => {
            console.error("Failed to copy code: ", err);
          });
        });

        // Position copy button based on wrapper layout
        const parent = pre.parentElement;
        if (parent && parent.classList.contains("guide-code-block-container")) {
          parent.style.position = "relative";
          parent.appendChild(button);
        } else {
          pre.style.position = "relative";
          pre.appendChild(button);
        }
      });
    };

    // Run immediately on page load/transition
    attachButtons();

    // Setup mutation observer to watch for content loads/lazy renders
    const observer = new MutationObserver(() => {
      attachButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [location.pathname]);
}
