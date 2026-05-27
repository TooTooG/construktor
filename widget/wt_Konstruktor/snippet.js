(function () {
  var widgetNodes = document.querySelectorAll("[data-dakimakura-widget]");

  if (!widgetNodes.length) {
    return;
  }

  var scrollLockState = {
    locked: false,
    scrollY: 0
  };

  widgetNodes.forEach(function (root) {
    initDakimakuraWidget(root);
  });

  function initDakimakuraWidget(root) {
    var form = root.querySelector("[data-dakimakura-form]");
    var modal = root.querySelector("[data-modal]");
    var modalDialog = root.querySelector(".dakimakura-modal__dialog");
    var catalogList = root.querySelector("[data-catalog-list]");
    var emptyState = root.querySelector("[data-empty-state]");
    var confirmSelectionButton = root.querySelector("[data-confirm-selection]");
    var searchInput = root.querySelector("[data-search-input]");
    var modalTitle = root.querySelector("[data-modal-title]");
    var statusNode = root.querySelector("[data-status]");
    var submitButton = root.querySelector("[data-submit]");
    var submitLabelNode = submitButton ? submitButton.querySelector("span") : null;
    var titleNode = root.querySelector("[data-product-title]");
    var optionsRoot = root.querySelector("[data-options-root]");
    var productLoadingNode = root.querySelector("[data-product-loading]");
    var backendUrl = form ? String(form.getAttribute("data-backend-url") || "").replace(/\/+$/, "") : "";
    var variantIdInput = root.querySelector("[data-variant-id-input]");
    var commentInput = root.querySelector("[data-comment-input]");
    var priceNode = root.querySelector("[data-product-card-price]");
    var oldPriceNode = root.querySelector("[data-product-card-old-price]");
    var availabilityNode = root.querySelector("[data-product-card-available]");
    var quantityInput = root.querySelector("[data-qty-input]");
    var descriptionRoot = root.querySelector("[data-description-root]");
    var descriptionNode = root.querySelector("[data-product-description]");
    var specsRoot = root.querySelector("[data-specs-root]");
    var propertiesNode = root.querySelector("[data-product-properties]");
    var requireBack = String(root.getAttribute("data-require-back")) !== "false";
    var frontCatalog = parseCatalog(root.querySelector("[data-front-catalog]"));
    var backCatalog = parseCatalog(root.querySelector("[data-back-catalog]"));
    var state;

    if (!form || !modal || !catalogList || !confirmSelectionButton || !searchInput) {
      return;
    }

    state = {
      activeSide: "front",
      pendingSelectionId: null,
      product: null,
      selectedVariant: null,
      optionGroups: [],
      optionSelection: {},
      selected: {
        front: null,
        back: null
      },
      catalogs: {
        front: frontCatalog,
        back: backCatalog.length ? backCatalog : frontCatalog
      }
    };

    bindQuantityButtons();
    bindCanvasButtons();
    bindModal();

    if (submitButton) {
      submitButton.disabled = true;
    }

    renderCatalog();
    loadTemplateProduct();
    syncSubmitReadiness();

    form.addEventListener("submit", function (event) {
      var requestPayload;

      event.preventDefault();

      if (!state.product) {
        setStatus("Подождите, страница еще загружается.", "error");
        return;
      }

      if (!state.selected.front) {
        setStatus("Выберите изображение для лицевой стороны.", "error");
        return;
      }

      if (requireBack && !state.selected.back) {
        setStatus("Выберите изображение для обратной стороны.", "error");
        return;
      }

      if (!state.selectedVariant || !state.selectedVariant.id) {
        setStatus("Выберите параметры товара.", "error");
        return;
      }

      if (!state.selectedVariant.available) {
        setStatus("Этот вариант сейчас недоступен.", "error");
        return;
      }

      if (!backendUrl) {
        setStatus("Конструктор временно недоступен.", "error");
        return;
      }

      fillComment();
      setSubmitLoading(true);
      setStatus("Собираем ваш товар...", "progress");

      requestPayload = buildBackendPayload();
      requestBuild(requestPayload)
        .then(function (buildResponse) {
          return pollBuildReady(buildResponse.buildId);
        })
        .then(function (buildResult) {
          submitGeneratedVariant(buildResult.variantId);
        })
        .catch(function (error) {
          setSubmitLoading(false);
          setStatus(getUserErrorMessage(error), "error");
        });
    });

    function loadTemplateProduct() {
      var productId = parseInt(form.getAttribute("data-product-id"), 10);

      if (!productId) {
        setStatus("Не удалось открыть конструктор. Обновите страницу.", "error");
        if (productLoadingNode) {
          productLoadingNode.textContent = "Не удалось загрузить товар.";
        }
        return;
      }

      if (typeof Products !== "undefined" && typeof Products.get === "function") {
        Products.get(productId)
          .done(handleProductLoaded)
          .fail(function () {
            loadTemplateProductByApi(productId);
          });
        return;
      }

      loadTemplateProductByApi(productId);
    }

    function loadTemplateProductByApi(productId) {
      fetch("/products_by_id/" + productId + ".json", {
        credentials: "same-origin"
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }

          return response.json();
        })
        .then(function (responseData) {
          var product = normalizeApiProductResponse(responseData, productId);

          if (!product) {
            throw new Error("Product not found");
          }

          handleProductLoaded(product);
        })
        .catch(function () {
          setStatus("Не удалось открыть конструктор. Обновите страницу.", "error");
          if (productLoadingNode) {
            productLoadingNode.textContent = "Не удалось загрузить товар.";
          }
        });
    }

    function handleProductLoaded(product) {
      state.product = product;
      renderProduct(product);
      syncSubmitReadiness();
      setStatus("", "");
    }

    function renderProduct(product) {
      var defaultVariant = getDefaultVariant(Array.isArray(product.variants) ? product.variants : []);
      var hasCustomTitle = titleNode && normalizeText(titleNode.textContent) && normalizeText(titleNode.textContent) !== normalizeText("Загрузка товара...");

      if (titleNode && !hasCustomTitle) {
        titleNode.textContent = product.title || "Товар";
      }

      if (productLoadingNode) {
        productLoadingNode.remove();
      }

      state.optionGroups = buildOptionGroups(product.variants);
      state.selectedVariant = defaultVariant;
      state.optionSelection = getVariantSelection(defaultVariant);

      renderOptionGroups();
      renderDescription(product);
      renderProperties(product);
      syncSelectedVariant();
    }

    function renderOptionGroups() {
      if (!optionsRoot) {
        return;
      }

      if (!state.optionGroups.length) {
        optionsRoot.innerHTML = "";
        return;
      }

      optionsRoot.innerHTML = state.optionGroups.map(function (group) {
        return [
          '<div class="dakimakura-card__group">',
          '<div class="dakimakura-card__group-title">',
          escapeHtml(group.title),
          "</div>",
          '<div class="dakimakura-card__chips">',
          group.values.map(function (value) {
            var isActive = state.optionSelection[group.key] === value.key;
            var isAvailable = isOptionValueAvailable(group.key, value.key);

            return [
              '<button class="dakimakura-card__chip',
              isActive ? ' is-active' : '',
              '" type="button" data-variant-option data-option-group="',
              escapeAttribute(group.key),
              '" data-option-value="',
              escapeAttribute(value.key),
              '"',
              isAvailable ? "" : " disabled",
              ">",
              escapeHtml(value.title),
              "</button>"
            ].join("");
          }).join(""),
          "</div>",
          "</div>"
        ].join("");
      }).join("");

      bindVariantOptionButtons();
    }

    function bindVariantOptionButtons() {
      optionsRoot.querySelectorAll("[data-variant-option]").forEach(function (button) {
        button.addEventListener("click", function () {
          var groupKey = button.getAttribute("data-option-group");
          var valueKey = button.getAttribute("data-option-value");
          var nextSelection = Object.assign({}, state.optionSelection);
          var matchedVariant;

          nextSelection[groupKey] = valueKey;
          matchedVariant = findVariantBySelection(state.product.variants, nextSelection);

          if (!matchedVariant) {
            matchedVariant = findVariantBySingleChoice(state.product.variants, groupKey, valueKey);
          }

          if (!matchedVariant) {
            return;
          }

          state.selectedVariant = matchedVariant;
          state.optionSelection = getVariantSelection(matchedVariant);
          renderOptionGroups();
          syncSelectedVariant();
          syncSubmitReadiness();
        });
      });
    }

    function isOptionValueAvailable(groupKey, valueKey) {
      return (state.product.variants || []).some(function (variant) {
        var selection = getVariantSelection(variant);
        var currentSelection = state.optionSelection;
        var keys = Object.keys(currentSelection);

        if (selection[groupKey] !== valueKey) {
          return false;
        }

        return keys.every(function (key) {
          if (key === groupKey) {
            return true;
          }

          return !currentSelection[key] || selection[key] === currentSelection[key];
        });
      });
    }

    function renderDescription(product) {
      var description = product && product.description ? String(product.description).trim() : "";

      if (!descriptionRoot || !descriptionNode) {
        return;
      }

      if (!description) {
        descriptionRoot.hidden = true;
        return;
      }

      descriptionNode.innerHTML = description;
      descriptionRoot.hidden = false;
    }

    function renderProperties(product) {
      var properties = Array.isArray(product && product.properties) ? product.properties.filter(isVisibleProperty) : [];

      if (!specsRoot || !propertiesNode) {
        return;
      }

      if (!properties.length) {
        specsRoot.hidden = true;
        return;
      }

      propertiesNode.innerHTML = properties.map(function (property) {
        return [
          '<div class="dakimakura-card__spec-row">',
          '<span class="dakimakura-card__spec-name">', escapeHtml(property.title || property.name || "Параметр"), "</span>",
          '<span class="dakimakura-card__spec-value">', escapeHtml(property.characteristic_title || property.value || property.content || ""), "</span>",
          "</div>"
        ].join("");
      }).join("");

      specsRoot.hidden = false;
    }

    function isVisibleProperty(property) {
      var title = normalizeText(property && (property.title || property.name));
      var value = property && (property.characteristic_title || property.value || property.content || "");

      if (!title || !String(value || "").trim()) {
        return false;
      }

      return title !== "label";
    }

    function syncSelectedVariant() {
      var variant = state.selectedVariant || getDefaultVariant(state.product && state.product.variants ? state.product.variants : []);
      var oldPrice;
      if (!variant) {
        return;
      }

      if (variantIdInput) {
        variantIdInput.value = String(variant.id);
      }

      if (priceNode) {
        priceNode.textContent = formatMoneyValue(variant.price || state.product.price_min || state.product.price);
      }

      if (oldPriceNode) {
        oldPrice = variant.old_price || state.product.old_price;
        oldPriceNode.textContent = oldPrice && oldPrice > (variant.price || 0) ? formatMoneyValue(oldPrice) : "";
      }

      if (availabilityNode) {
        availabilityNode.textContent = variant.available ? "В наличии" : "Нет в наличии";
      }

      fillComment();
    }

    function buildBackendPayload() {
      return {
        templateProductId: parseInt(form.getAttribute("data-product-id"), 10),
        templateVariantId: parseInt(state.selectedVariant && state.selectedVariant.id ? state.selectedVariant.id : "0", 10) || null,
        frontProductId: parseInt(state.selected.front.id, 10),
        backProductId: parseInt((state.selected.back || state.selected.front).id, 10),
        quantity: Math.max(1, parseInt(quantityInput && quantityInput.value ? quantityInput.value : "1", 10) || 1),
        selection: buildSelectionPayload(state.selectedVariant)
      };
    }

    function buildSelectionPayload(variant) {
      var payload = {};

      (variant && variant.option_values || []).forEach(function (optionValue, index) {
        var optionName = optionValue.option_name && (optionValue.option_name.handle || optionValue.option_name.title || optionValue.option_name.name)
          || optionValue.option_name_title
          || ("option_" + (index + 1));
        var optionId = optionValue.option_name_id || optionValue.option_name && optionValue.option_name.id;
        var optionKey = optionId
          ? "option-" + String(optionId) + "-" + slugify(optionName)
          : String(optionName).trim().toLowerCase();

        payload[optionKey] = String(optionValue.title || optionValue.value || "").trim();
      });

      if (!Object.keys(payload).length && variant && variant.title) {
        payload.variant = String(variant.title);
      }

      return payload;
    }

    function requestBuild(payload) {
      return fetch(backendUrl + "/api/constructor/build", {
        method: "POST",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).then(function (response) {
        if (!response.ok) {
          return response.text().then(function (text) {
            throw new Error(text || "BUILD_REQUEST_FAILED");
          });
        }

        return response.json();
      });
    }

    function pollBuildReady(buildId) {
      var startedAt = Date.now();

      return new Promise(function (resolve, reject) {
        function tick() {
          fetch(backendUrl + "/api/constructor/build/" + encodeURIComponent(buildId), {
            method: "GET",
            credentials: "omit"
          })
            .then(function (response) {
              if (!response.ok) {
                return response.text().then(function (text) {
                  throw new Error(text || "BUILD_STATUS_FAILED");
                });
              }

              return response.json();
            })
            .then(function (data) {
              if (data.status === "ready" && data.variantId) {
                resolve(data);
                return;
              }

              if (data.status === "failed") {
                reject(new Error(data.error || "BUILD_FAILED"));
                return;
              }

              if (Date.now() - startedAt > 120000) {
                reject(new Error("BUILD_TIMEOUT"));
                return;
              }

              setStatus("Готовим товар...", "progress");
              window.setTimeout(tick, 1800);
            })
            .catch(reject);
        }

        tick();
      });
    }

    function submitGeneratedVariant(variantId) {
      var action = form.getAttribute("action") || "/cart_items";
      var quantity = Math.max(1, parseInt(quantityInput && quantityInput.value ? quantityInput.value : "1", 10) || 1);
      var postForm = document.createElement("form");
      var variantField = document.createElement("input");
      var quantityField = document.createElement("input");

      postForm.method = "post";
      postForm.action = action;
      postForm.style.display = "none";

      variantField.type = "hidden";
      variantField.name = "variant_id";
      variantField.value = String(variantId);

      quantityField.type = "hidden";
      quantityField.name = "quantity";
      quantityField.value = String(quantity);

      postForm.appendChild(variantField);
      postForm.appendChild(quantityField);
      document.body.appendChild(postForm);

      if (variantIdInput) {
        variantIdInput.value = String(variantId);
      }

      setStatus("Товар готов. Переходим в корзину...", "success");
      postForm.submit();
    }

    function bindQuantityButtons() {
      if (!quantityInput) {
        return;
      }

      root.querySelectorAll("[data-qty-step]").forEach(function (button) {
        button.addEventListener("click", function () {
          var step = parseInt(button.getAttribute("data-qty-step"), 10) || 0;
          var nextValue = Math.max(1, (parseInt(quantityInput.value, 10) || 1) + step);

          quantityInput.value = String(nextValue);
        });
      });

      quantityInput.addEventListener("change", function () {
        var nextValue = Math.max(1, parseInt(quantityInput.value, 10) || 1);
        quantityInput.value = String(nextValue);
      });
    }

    function bindCanvasButtons() {
      root.querySelectorAll("[data-modal-open]").forEach(function (button) {
        button.addEventListener("click", function () {
          openModal(button.getAttribute("data-side"), button.getAttribute("data-side-label"));
        });
      });
    }

    function bindModal() {
      root.querySelectorAll("[data-modal-close]").forEach(function (button) {
        button.addEventListener("click", closeModal);
      });

      modal.addEventListener("wheel", handleModalWheel, { passive: false });
      modal.addEventListener("touchmove", handleModalTouchMove, { passive: false });

      searchInput.addEventListener("input", renderCatalog);

      confirmSelectionButton.addEventListener("click", function () {
        var selectedItem = findCatalogItem(state.activeSide, state.pendingSelectionId);

        if (!selectedItem) {
          return;
        }

        state.selected[state.activeSide] = selectedItem;
        applySelection(state.activeSide, selectedItem);
        setStatus("", "");
        closeModal();
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !modal.hidden) {
          closeModal();
        }
      });
    }

    function openModal(side, sideLabel) {
      state.activeSide = side;
      state.pendingSelectionId = state.selected[side] ? state.selected[side].id : null;
      modal.hidden = false;
      if (modalTitle) {
        modalTitle.textContent = sideLabel || getSideLabel(side);
      }
      searchInput.value = "";
      renderCatalog();
      lockPageScroll();
      window.setTimeout(function () {
        searchInput.focus();
      }, 10);
    }

    function closeModal() {
      modal.hidden = true;
      unlockPageScroll();
    }

    function handleModalWheel(event) {
      if (modal.hidden) {
        return;
      }

      if (!modalDialog || !modalDialog.contains(event.target)) {
        event.preventDefault();
        return;
      }

      if (shouldPreventScrollChain(modalDialog, event.deltaY)) {
        event.preventDefault();
      }
    }

    function handleModalTouchMove(event) {
      if (modal.hidden) {
        return;
      }

      if (!modalDialog || !modalDialog.contains(event.target)) {
        event.preventDefault();
      }
    }

    function renderCatalog() {
      var query = normalizeText(searchInput.value);
      var catalog = state.catalogs[state.activeSide] || [];
      var filteredItems = catalog.filter(function (item) {
        return !query || item.searchIndex.indexOf(query) !== -1;
      });

      catalogList.innerHTML = "";
      emptyState.hidden = filteredItems.length > 0;

      filteredItems.forEach(function (item) {
        catalogList.appendChild(createCatalogCard(item));
      });

      confirmSelectionButton.disabled = !state.pendingSelectionId;
    }

    function createCatalogCard(item) {
      var card = document.createElement("button");
      var media = document.createElement("span");
      var image = document.createElement("img");
      var content = document.createElement("span");
      var title = document.createElement("span");
      var isSelected = state.pendingSelectionId === item.id;

      card.type = "button";
      card.className = "dakimakura-modal__card" + (isSelected ? " is-selected" : "");
      card.setAttribute("data-catalog-id", item.id);

      media.className = "dakimakura-modal__card-media";
      image.src = item.image;
      image.alt = item.title;
      image.loading = "lazy";
      media.appendChild(image);

      content.className = "dakimakura-modal__card-content";
      title.className = "dakimakura-modal__card-title";
      title.textContent = item.title;
      content.appendChild(title);
      card.appendChild(media);
      card.appendChild(content);

      card.addEventListener("click", function () {
        state.pendingSelectionId = item.id;
        renderCatalog();
      });

      return card;
    }

    function findCatalogItem(side, id) {
      return (state.catalogs[side] || []).find(function (item) {
        return item.id === id;
      }) || null;
    }

    function applySelection(side, item) {
      var canvas = root.querySelector('[data-modal-open][data-side="' + side + '"]');
      var placeholder = canvas ? canvas.querySelector("[data-placeholder]") : null;
      var preview = canvas ? canvas.querySelector("[data-preview]") : null;
      var previewImage = canvas ? canvas.querySelector("[data-preview-image]") : null;
      var previewTitle = canvas ? canvas.querySelector("[data-preview-title]") : null;
      var src = item.image || buildPlaceholderImage(item.title, getSideLabel(side));

      if (!canvas || !placeholder || !preview || !previewImage || !previewTitle) {
        return;
      }

      canvas.classList.add("is-filled");
      placeholder.hidden = true;
      preview.hidden = false;
      previewImage.src = src;
      previewImage.alt = item.title;
      previewTitle.textContent = item.title;

      fillComment();
      syncSubmitReadiness();
    }

    function fillComment() {
      if (!commentInput) {
        return;
      }

      commentInput.value = buildCommentText();
    }

    function buildCommentText() {
      var lines = [
        "Конструктор дакимакуры",
        "Код сборки: " + (buildConstructorCode() || ""),
        "Вариант: " + (buildVariantTitle(state.selectedVariant) || ""),
        "Лицевая сторона: " + formatSelection(state.selected.front),
        "Обратная сторона: " + formatSelection(state.selected.back),
        "DAKI_PREVIEW_IMAGE::" + getPreviewImage(),
        "DAKI_FRONT_TITLE::" + getSelectionField(state.selected.front, "title"),
        "DAKI_FRONT_IMAGE::" + getSelectionField(state.selected.front, "image"),
        "DAKI_FRONT_URL::" + getSelectionField(state.selected.front, "url"),
        "DAKI_BACK_TITLE::" + getSelectionField(state.selected.back, "title"),
        "DAKI_BACK_IMAGE::" + getSelectionField(state.selected.back, "image"),
        "DAKI_BACK_URL::" + getSelectionField(state.selected.back, "url")
      ];

      return lines.join("\n");
    }

    function getPreviewImage() {
      return getSelectionField(state.selected.front, "image") || getSelectionField(state.selected.back, "image");
    }

    function getSelectionField(selection, field) {
      if (!selection || !selection[field]) {
        return "";
      }

      return String(selection[field]);
    }

    function buildConstructorCode() {
      var tokens = [
        "DAKI",
        createToken(buildVariantTitle(state.selectedVariant)),
        createToken(state.selected.front && state.selected.front.handle),
        createToken(state.selected.back && state.selected.back.handle)
      ].filter(Boolean);

      return tokens.join("-");
    }

    function createToken(value) {
      return String(value || "")
        .toUpperCase()
        .replace(/<[^>]+>/g, "")
        .replace(/[^A-Z0-9А-ЯЁ]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24);
    }

    function formatSelection(item) {
      if (!item) {
        return "Не выбрано";
      }

      var parts = [item.title];

      if (item.url) {
        parts.push(item.url);
      }

      if (item.image) {
        parts.push(item.image);
      }

      return parts.join(" | ");
    }

    function buildVariantTitle(variant) {
      if (!variant) {
        return "";
      }

      if (variant.option_values && variant.option_values.length) {
        return variant.option_values.map(function (optionValue) {
          return optionValue.title;
        }).join(", ");
      }

      return variant.title || "";
    }

    function syncSubmitReadiness() {
      var isReady = Boolean(state.product && state.selected.front && (!requireBack || state.selected.back) && state.selectedVariant && state.selectedVariant.available);

      root.classList.toggle("is-ready", isReady);

      if (submitButton) {
        submitButton.disabled = !isReady;
      }
    }

    function setSubmitLoading(isLoading) {
      if (!submitButton) {
        return;
      }

      submitButton.disabled = isLoading;
      submitButton.classList.toggle("is-loading", isLoading);

      if (submitLabelNode) {
        submitLabelNode.textContent = isLoading
          ? submitButton.getAttribute("data-loading-label") || "Добавляем..."
          : submitButton.getAttribute("data-default-label") || "В корзину";
      }
    }

    function setStatus(message, tone) {
      if (!statusNode) {
        return;
      }

      statusNode.textContent = message || "";
      statusNode.setAttribute("data-tone", tone || "");
    }

    function getUserErrorMessage(error) {
      var message = error instanceof Error ? error.message : "";

      if (!message) {
        return "Не удалось создать товар. Попробуйте еще раз.";
      }

      if (message.indexOf("BUILD_TIMEOUT") !== -1) {
        return "Сборка заняла слишком много времени. Попробуйте еще раз.";
      }

      if (message.indexOf("BUILD_FAILED") !== -1) {
        return "Не удалось собрать товар. Попробуйте еще раз.";
      }

      if (message.indexOf("BUILD_REQUEST_FAILED") !== -1 || message.indexOf("BUILD_STATUS_FAILED") !== -1) {
        return "Не удалось связаться с сервисом конструктора.";
      }

      return "Не удалось создать товар. Попробуйте еще раз.";
    }
  }

  function parseCatalog(node) {
    var text;
    var parsed;

    if (!node) {
      return [];
    }

    text = (node.textContent || "").trim();

    if (!text) {
      return [];
    }

    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return [];
    }

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeCatalogItem);
  }

  function normalizeCatalogItem(item) {
    var title = item && item.title ? String(item.title) : "Без названия";
    var handle = item && item.handle ? String(item.handle) : slugify(title);

    return {
      id: item && item.id ? String(item.id) : slugify(title),
      title: title,
      image: item && item.image ? String(item.image) : buildPlaceholderImage(title, "Принт"),
      url: item && item.url ? String(item.url) : "",
      handle: handle,
      searchIndex: normalizeText(title + " " + handle)
    };
  }

  function buildPlaceholderImage(title, subtitle) {
    var shortTitle = title.length > 32 ? title.slice(0, 29) + "..." : title;
    var svg = [
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 1280'>",
      "<defs>",
      "<linearGradient id='bg' x1='0%' y1='0%' x2='100%' y2='100%'>",
      "<stop offset='0%' stop-color='#fef7dd'/>",
      "<stop offset='100%' stop-color='#f4fbff'/>",
      "</linearGradient>",
      "</defs>",
      "<rect width='640' height='1280' rx='44' fill='url(#bg)'/>",
      "<rect x='24' y='24' width='592' height='1232' rx='34' fill='none' stroke='#d5dce5' stroke-width='4' stroke-dasharray='16 14'/>",
      "<circle cx='320' cy='510' r='74' fill='#edf5f0'/>",
      "<path d='M320 472v76M282 510h76' stroke='#31343a' stroke-width='12' stroke-linecap='round'/>",
      "<text x='320' y='660' text-anchor='middle' font-family='Arial, sans-serif' font-size='30' fill='#31343a'>",
      escapeXml(subtitle),
      "</text>",
      "<text x='320' y='715' text-anchor='middle' font-family='Arial, sans-serif' font-size='28' fill='#4f5560'>",
      escapeXml(shortTitle),
      "</text>",
      "</svg>"
    ].join("");

    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  function getSideLabel(side) {
    return side === "back" ? "Обратная сторона" : "Лицевая сторона";
  }

  function getDefaultVariant(variants) {
    var availableVariant = variants.find(function (variant) {
      return variant && variant.available;
    });

    return availableVariant || variants[0] || null;
  }

  function buildOptionGroups(variants) {
    var groups = [];
    var groupsMap = {};

    (variants || []).forEach(function (variant) {
      (variant.option_values || []).forEach(function (optionValue, index) {
        var optionName = optionValue.option_name && (optionValue.option_name.title || optionValue.option_name.name) || optionValue.option_name_title || ("Опция " + (index + 1));
        var groupKey = optionValue.option_name && (optionValue.option_name.id || optionValue.option_name.handle) || optionValue.option_name_id || slugify(optionName);
        var valueKey = optionValue.id || optionValue.position || slugify(optionValue.title || optionValue.name || "");
        var existingGroup = groupsMap[groupKey];

        if (!existingGroup) {
          existingGroup = {
            key: String(groupKey),
            title: String(optionName),
            values: []
          };
          groupsMap[groupKey] = existingGroup;
          groups.push(existingGroup);
        }

        if (!existingGroup.values.some(function (value) { return value.key === String(valueKey); })) {
          existingGroup.values.push({
            key: String(valueKey),
            title: String(optionValue.title || optionValue.name || valueKey)
          });
        }
      });
    });

    return groups;
  }

  function getVariantSelection(variant) {
    var selection = {};

    (variant && variant.option_values || []).forEach(function (optionValue, index) {
      var optionName = optionValue.option_name && (optionValue.option_name.title || optionValue.option_name.name) || optionValue.option_name_title || ("Опция " + (index + 1));
      var groupKey = optionValue.option_name && (optionValue.option_name.id || optionValue.option_name.handle) || optionValue.option_name_id || slugify(optionName);
      var valueKey = optionValue.id || optionValue.position || slugify(optionValue.title || optionValue.name || "");

      selection[String(groupKey)] = String(valueKey);
    });

    return selection;
  }

  function findVariantBySelection(variants, selection) {
    return (variants || []).find(function (variant) {
      var variantSelection = getVariantSelection(variant);

      return Object.keys(selection || {}).every(function (key) {
        return !selection[key] || variantSelection[key] === selection[key];
      });
    }) || null;
  }

  function findVariantBySingleChoice(variants, groupKey, valueKey) {
    return (variants || []).find(function (variant) {
      var variantSelection = getVariantSelection(variant);
      return variantSelection[groupKey] === valueKey;
    }) || null;
  }

  function normalizeApiProductResponse(responseData, productId) {
    var product = null;

    if (Array.isArray(responseData)) {
      product = responseData[0] || null;
    } else if (responseData && Array.isArray(responseData.products)) {
      product = responseData.products[0] || null;
    } else if (responseData && responseData.id) {
      product = responseData;
    } else if (responseData && responseData[String(productId)]) {
      product = responseData[String(productId)];
    }

    if (!product) {
      return null;
    }

    return {
      id: product.id,
      title: product.title,
      description: product.description || product.short_description || "",
      available: typeof product.available === "boolean" ? product.available : true,
      price: toNumber(product.price),
      old_price: toNumber(product.old_price),
      price_min: toNumber(product.price_min || product.price),
      properties: normalizeProperties(product.properties || product.characteristics || []),
      variants: normalizeVariants(product.variants, product)
    };
  }

  function normalizeProperties(properties) {
    return (properties || []).map(function (property) {
      return {
        title: property.title || property.name || property.property_name || "",
        value: property.value || property.characteristic_title || property.content || property.title_value || ""
      };
    });
  }

  function normalizeVariants(variants, product) {
    var source = Array.isArray(variants) ? variants : [];

    if (!source.length && product && product.id) {
      return [{
        id: product.id,
        title: product.title || "Основной вариант",
        available: typeof product.available === "boolean" ? product.available : true,
        price: toNumber(product.price),
        old_price: toNumber(product.old_price),
        option_values: normalizeOptionValues(product.option_values || [])
      }];
    }

    return source.map(function (variant) {
      return {
        id: variant.id,
        title: variant.title || variant.option_title || ("Вариант " + variant.id),
        available: typeof variant.available === "boolean" ? variant.available : true,
        price: toNumber(variant.price),
        old_price: toNumber(variant.old_price),
        option_values: normalizeOptionValues(variant.option_values || variant.option_values_attributes || [])
      };
    });
  }

  function normalizeOptionValues(optionValues) {
    return (optionValues || []).map(function (optionValue, index) {
      var optionName = optionValue.option_name || optionValue.option || {};

      return {
        id: optionValue.id || optionValue.value_id || optionValue.position || index + 1,
        title: optionValue.title || optionValue.name || optionValue.value || "",
        position: optionValue.position || index + 1,
        option_name_id: optionValue.option_name_id || optionName.id || index + 1,
        option_name_title: optionValue.option_name_title || optionName.title || optionName.name || ("Опция " + (index + 1)),
        option_name: {
          id: optionName.id || optionValue.option_name_id || index + 1,
          title: optionName.title || optionName.name || optionValue.option_name_title || ("Опция " + (index + 1)),
          handle: optionName.handle || slugify(optionName.title || optionName.name || optionValue.option_name_title || ("Опция " + (index + 1)))
        }
      };
    }).filter(function (optionValue) {
      return optionValue.title;
    });
  }

  function formatMoneyValue(value) {
    var amount = toNumber(value);

    if (!amount) {
      return "0 ₽";
    }

    return amount.toLocaleString("ru-RU") + " ₽";
  }

  function toNumber(value) {
    var normalized = Number(String(value == null ? 0 : value).replace(/\s+/g, "").replace(",", "."));

    if (!Number.isFinite(normalized)) {
      return 0;
    }

    return normalized;
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function slugify(value) {
    return normalizeText(value)
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-+|-+$/g, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function escapeXml(value) {
    return escapeHtml(value);
  }

  function shouldPreventScrollChain(element, deltaY) {
    if (!element) {
      return true;
    }

    var canScroll = element.scrollHeight > element.clientHeight;
    var isScrollingUp = deltaY < 0;
    var isAtTop = element.scrollTop <= 0;
    var isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;

    if (!canScroll) {
      return true;
    }

    if (isScrollingUp && isAtTop) {
      return true;
    }

    if (!isScrollingUp && isAtBottom) {
      return true;
    }

    return false;
  }

  function lockPageScroll() {
    if (scrollLockState.locked) {
      return;
    }

    scrollLockState.locked = true;
    scrollLockState.scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = "fixed";
    document.body.style.top = "-" + scrollLockState.scrollY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockPageScroll() {
    if (!scrollLockState.locked) {
      return;
    }

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollLockState.scrollY);
    scrollLockState.locked = false;
  }
})();
