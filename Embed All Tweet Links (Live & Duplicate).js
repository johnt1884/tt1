// ==UserScript==
// @name         Embed All Tweet Links (Live & Duplicate)
// @namespace    https://example.com/
// @version      2.0
// @description  Embed all tweet links (even duplicates), including ones added after page load
// @match        https://boards.4chan.org/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const TWEET_URL_REGEX = /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/(\d+)/gi;
  const WIDGETS_SRC = 'https://platform.twitter.com/widgets.js';

  function ensureWidgetsScript(callback) {
    if (window.twttr?.widgets?.load) {
      callback?.();
    } else {
      const script = document.createElement('script');
      script.src = WIDGETS_SRC;
      script.async = true;
      script.onload = () => callback?.();
      document.head.appendChild(script);
    }
  }

  function convertTextURLsToLinks(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentNode.nodeName === 'A') continue;

      const text = node.textContent;
      const matches = [...text.matchAll(TWEET_URL_REGEX)];
      if (!matches.length) continue;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;

      for (const match of matches) {
        const url = match[0];
        const start = match.index;
        const end = start + url.length;

        if (start > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
        }

        const a = document.createElement('a');
        a.href = url;
        a.textContent = url;
        frag.appendChild(a);

        lastIndex = end;
      }

      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      node.parentNode.replaceChild(frag, node);
    }
  }

  function embedTweetLinks(root) {
    const links = root.querySelectorAll('a[href*="twitter.com"], a[href*="x.com"]');
    links.forEach(link => {
      const href = link.href.replace(/^https?:\/\/x\.com/, 'https://twitter.com');
      if (!TWEET_URL_REGEX.test(href)) return;

      // Prevent double-embedding for this exact link
      const next = link.nextElementSibling;
      if (next?.classList.contains('twitter-tweet') &&
          next.querySelector('a')?.href.replace('x.com', 'twitter.com') === href) return;

      const blockquote = document.createElement('blockquote');
      blockquote.className = 'twitter-tweet';
      blockquote.innerHTML = `<a href="${href}"></a>`;
      link.insertAdjacentElement('afterend', blockquote);
    });

    ensureWidgetsScript(() => window.twttr.widgets.load());
  }

  function processTweets(root = document.body) {
    convertTextURLsToLinks(root);
    embedTweetLinks(root);
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) processTweets(node);
      });
    }
  });

  // Initial run
  processTweets();

  // Live updates
  observer.observe(document.body, { childList: true, subtree: true });
})();
