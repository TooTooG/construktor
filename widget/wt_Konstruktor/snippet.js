document.addEventListener('DOMContentLoaded', function () {
  var constructors = document.querySelectorAll('[data-dakimakura-constructor]');

  constructors.forEach(function (root) {
    createDakimakuraConstructor(root);
  });
});

function createDakimakuraConstructor(root) {
  var state = {
    templateProductId: parseInt(root.dataset.templateProductId || '', 10),
    backendUrl: normalizeBackendUrl(root.dataset.backendUrl || ''),
    requireBackSelection: parseBoolean(root.dataset.requireBackSelection),
    product: null,
    groupedOptions: [],
    selectedOptions: {},
    selectedVariant: null,
    selectedImages: {
      front: null,
      back: null,
    },
    activeSide: 'front',
    modalSelection: null,
    catalogs: {
      front: parseCatalog(root.querySelector('[data-front-products]')),
      back: parseCatalog(root.querySelector('[data-back-products]')),
    },
    buildId: null,
    isSubmitting: false,
  };

  var elements = {
    title: root.querySelector('[data-product-title]'),
    optionsRoot: root.querySelector('[data-options-root]'),
    description: root.querySelector('[data-description]'),
    properties: root.querySelector('[data-properties]'),
    priceRow: root.querySelector('[data-price-row]'),
    price: root.querySelector('[data-product-price]'),
    oldPrice: root.querySelector('[data-product-old-price]'),
    quantity: root.querySelector('[data-quantity]'),
    submit: root.querySelector('[data-submit]'),
    status: root.querySelector('[data-status]'),
    form: root.querySelector('[data-constructor-form]'),
    modal: root.querySelector('[data-picker-modal]'),
    modalTitle: root.querySelector('[data-modal-title]'),
    modalSearch: root.querySelector('[data-modal-search]'),
    modalContent: root.querySelector('[data-modal-content]'),
    modalEmpty: root.querySelector('[data-modal-empty]'),
    modalConfirm: root.querySelector('[data-modal-confirm]'),
    previewFrontImage: root.querySelector('[data-preview-image="front"]'),
    previewBackImage: root.querySelector('[data-preview-image="back"]'),
    previewFrontPlaceholder: root.querySelector('[data-preview-placeholder="front"]'),
    previewBackPlaceholder: root.querySelector('[data-preview-placeholder="back"]'),
    previewFrontName: root.querySelector('[data-preview-name="front"]'),
    previewBackName: root.querySelector('[data-preview-name="back"]'),
  };

  bindEvents();
  init();

  function init() {
    if (!state.templateProductId || Number.isNaN(state.templateProductId)) {
      setStatus('Укажите товар для конструктора в настройках виджета.');
      lockSubmit(true);
      return;
    }

    if (!state.catalogs.front.length) {
      setStatus('Добавьте изображения в коллекцию лицевой стороны.');
      lockSubmit(true);
      return;
    }

    if (state.requireBackSelection && !state.catalogs.back.length) {
      setStatus('Добавьте изображения в коллекцию обратной стороны.');
      lockSubmit(true);
      return;
    }

    setStatus('Подождите, страница еще загружается.');
    lockSubmit(true);

    loadProduct(state.templateProductId)
      .then(function (product) {
        state.product = product;
        hydrateProduct(product);
      })
      .catch(function (error) {
        console.error(error);
        setStatus('Не удалось загрузить товар. Проверьте настройки и попробуйте еще раз.');
        lockSubmit(true);
      });
  }

  function bindEvents() {
    root.querySelectorAll('[data-open-picker]').forEach(function (button) {
      button.addEventListener('click', function () {
        openPicker(button.dataset.openPicker);
      });
    });

    root.querySelectorAll('[data-close-picker]').forEach(function (button) {
      button.addEventListener('click', closePicker);
    });

    if (elements.modalSearch) {
      elements.modalSearch.addEventListener('input', renderModalItems);
    }

    if (elements.modalConfirm) {
      elements.modalConfirm.addEventListener('click', confirmModalSelection);
    }

    if (elements.form) {
      elements.form.addEventListener('submit', handleSubmit);
    }
  }

  function hydrateProduct(product) {
    if (elements.title && !root.dataset.title) {
      elements.title.textContent = product.title;
    }

    state.groupedOptions = collectOptionGroups(product.variants || []);

    if (!state.groupedOptions.length) {
      setStatus('Для этого товара не настроены варианты выбора.');
      lockSubmit(true);
      return;
    }

    state.groupedOptions.forEach(function (group) {
      state.selectedOptions[group.key] = group.values[0] && group.values[0].value;
    });

    renderOptions();
    syncVariant();
    clearStatus();
  }

  function renderOptions() {
    if (!elements.optionsRoot) {
      return;
    }

    elements.optionsRoot.innerHTML = '';

    state.groupedOptions.forEach(function (group) {
      var section = document.createElement('section');
      section.className = 'dakimakura-constructor__option-group';

      var heading = document.createElement('div');
      heading.className = 'dakimakura-constructor__option-heading';
      heading.textContent = group.title;
      section.appendChild(heading);

      var values = document.createElement('div');
      values.className = 'dakimakura-constructor__option-values';

      group.values.forEach(function (item) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'dakimakura-constructor__chip';
        button.textContent = item.value;
        button.dataset.groupKey = group.key;
        button.dataset.value = item.value;

        if (state.selectedOptions[group.key] === item.value) {
          button.classList.add('is-active');
        }

        button.addEventListener('click', function () {
          state.selectedOptions[group.key] = item.value;
          renderOptions();
          syncVariant();
        });

        values.appendChild(button);
      });

      section.appendChild(values);
      elements.optionsRoot.appendChild(section);
    });
  }

  function syncVariant() {
    if (!state.product) {
      return;
    }

    var variant = (state.product.variants || []).find(function (item) {
      if (!item.option_values || !item.option_values.length) {
        return false;
      }

      return item.option_values.every(function (optionValue) {
        var key = buildOptionKey(optionValue.option_name_id, optionValue.option_name);
        return state.selectedOptions[key] === optionValue.title;
      });
    });

    state.selectedVariant = variant || null;
    updatePrice();
    updateSubmitState();
  }

  function updatePrice() {
    if (!elements.priceRow || !elements.price) {
      return;
    }

    if (!state.selectedVariant) {
      elements.priceRow.hidden = true;
      return;
    }

    elements.priceRow.hidden = false;
    elements.price.textContent = formatMoney(state.selectedVariant.price || state.selectedVariant.base_price || 0);

    if (elements.oldPrice) {
      var oldPrice = state.selectedVariant.old_price || 0;
      if (oldPrice && Number(oldPrice) > Number(state.selectedVariant.price || 0)) {
        elements.oldPrice.hidden = false;
        elements.oldPrice.textContent = formatMoney(oldPrice);
      } else {
        elements.oldPrice.hidden = true;
        elements.oldPrice.textContent = '';
      }
    }
  }

  function updateSubmitState() {
    if (state.isSubmitting) {
      lockSubmit(true);
      return;
    }

    if (!state.selectedImages.front) {
      setStatus('Выберите изображение для лицевой стороны.');
      lockSubmit(true);
      return;
    }

    if (state.requireBackSelection && !state.selectedImages.back) {
      setStatus('Выберите изображение для обратной стороны.');
      lockSubmit(true);
      return;
    }

    if (!state.selectedVariant) {
      setStatus('Выберите параметры товара.');
      lockSubmit(true);
      return;
    }

    if (state.selectedVariant.available === false || Number(state.selectedVariant.quantity || 0) < 0) {
      setStatus('Этот вариант сейчас недоступен.');
      lockSubmit(true);
      return;
    }

    if (!state.backendUrl) {
      setStatus('Добавьте адрес backend-сервиса в настройки виджета.');
      lockSubmit(true);
      return;
    }

    clearStatus();
    lockSubmit(false);
  }

  function openPicker(side) {
    state.activeSide = side;
    state.modalSelection = state.selectedImages[side] || null;

    if (elements.modalTitle) {
      elements.modalTitle.textContent = side === 'front' ? 'Лицевая сторона' : 'Обратная сторона';
    }

    if (elements.modalSearch) {
      elements.modalSearch.value = '';
    }

    renderModalItems();

    if (elements.modal) {
      elements.modal.hidden = false;
      document.body.classList.add('dakimakura-modal-open');
    }
  }

  function closePicker() {
    state.modalSelection = null;

    if (elements.modal) {
      elements.modal.hidden = true;
      document.body.classList.remove('dakimakura-modal-open');
    }
  }

  function renderModalItems() {
    if (!elements.modalContent) {
      return;
    }

    var query = elements.modalSearch ? elements.modalSearch.value.trim().toLowerCase() : '';
    var items = state.catalogs[state.activeSide] || [];
    var filtered = items.filter(function (item) {
      return !query || item.title.toLowerCase().indexOf(query) !== -1;
    });

    elements.modalContent.innerHTML = '';

    filtered.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'dakimakura-modal__card';
      button.dataset.productId = String(item.id);

      if (state.modalSelection && state.modalSelection.id === item.id) {
        button.classList.add('is-active');
      }

      button.innerHTML = [
        '<span class="dakimakura-modal__card-media">',
        item.image ? '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.title) + '" loading="lazy">' : '<span class="dakimakura-modal__card-fallback">Без фото</span>',
        '</span>',
        '<span class="dakimakura-modal__card-title">' + escapeHtml(item.title) + '</span>'
      ].join('');

      button.addEventListener('click', function () {
        state.modalSelection = item;
        renderModalItems();
      });

      elements.modalContent.appendChild(button);
    });

    if (elements.modalEmpty) {
      elements.modalEmpty.hidden = Boolean(filtered.length);
    }

    if (elements.modalConfirm) {
      elements.modalConfirm.disabled = !state.modalSelection;
    }
  }

  function confirmModalSelection() {
    if (!state.modalSelection) {
      return;
    }

    state.selectedImages[state.activeSide] = state.modalSelection;
    updatePreview(state.activeSide);
    closePicker();
    updateSubmitState();
  }

  function updatePreview(side) {
    var item = state.selectedImages[side];
    var imageElement = side === 'front' ? elements.previewFrontImage : elements.previewBackImage;
    var placeholder = side === 'front' ? elements.previewFrontPlaceholder : elements.previewBackPlaceholder;
    var nameElement = side === 'front' ? elements.previewFrontName : elements.previewBackName;

    if (!imageElement || !placeholder || !nameElement) {
      return;
    }

    if (!item) {
      imageElement.removeAttribute('src');
      imageElement.hidden = true;
      placeholder.hidden = false;
      nameElement.textContent = 'Фото не выбрано';
      return;
    }

    imageElement.src = item.image || '';
    imageElement.alt = item.title;
    imageElement.hidden = !item.image;
    placeholder.hidden = Boolean(item.image);
    nameElement.textContent = item.title;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (state.isSubmitting) {
      return;
    }

    updateSubmitState();

    if (elements.submit.disabled) {
      return;
    }

    state.isSubmitting = true;
    lockSubmit(true);
    setStatus('Собираем ваш товар...');

    buildGeneratedProduct()
      .then(function (payload) {
        setStatus('Товар готов. Переходим в корзину...');
        submitGeneratedVariant(payload.variantId);
      })
      .catch(function (error) {
        console.error(error);
        setStatus(getUserErrorMessage(error));
      })
      .finally(function () {
        state.isSubmitting = false;
        updateSubmitState();
      });
  }

  function buildGeneratedProduct() {
    var quantity = parsePositiveInteger(elements.quantity && elements.quantity.value) || 1;
    var selection = {};

    state.groupedOptions.forEach(function (group) {
      selection[group.key] = state.selectedOptions[group.key];
    });

    return fetch(state.backendUrl + '/api/constructor/build', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateProductId: state.templateProductId,
        frontProductId: state.selectedImages.front && state.selectedImages.front.id,
        backProductId: state.selectedImages.back && state.selectedImages.back.id,
        quantity: quantity,
        selection: selection,
      }),
    })
      .then(parseJsonResponse)
      .then(function (payload) {
        if (!payload || !payload.buildId) {
          throw new Error('Backend не вернул идентификатор сборки.');
        }

        state.buildId = payload.buildId;
        return pollBuildStatus(payload.buildId);
      });
  }

  function pollBuildStatus(buildId) {
    var startedAt = Date.now();
    var timeoutMs = 120000;
    var intervalMs = 2500;

    return new Promise(function (resolve, reject) {
      function tick() {
        fetch(state.backendUrl + '/api/constructor/build/' + encodeURIComponent(buildId), {
          headers: {
            Accept: 'application/json',
          },
        })
          .then(parseJsonResponse)
          .then(function (payload) {
            if (!payload || !payload.status) {
              throw new Error('Backend вернул пустой статус сборки.');
            }

            if (payload.status === 'ready') {
              if (!payload.generatedVariantId) {
                throw new Error('Товар создан, но variant_id не найден.');
              }

              resolve({
                buildId: buildId,
                productId: payload.generatedProductId,
                variantId: payload.generatedVariantId,
              });
              return;
            }

            if (payload.status === 'failed') {
              reject(new Error(payload.errorText || 'Не удалось подготовить товар. Попробуйте еще раз.'));
              return;
            }

            if (Date.now() - startedAt > timeoutMs) {
              reject(new Error('Сборка заняла слишком много времени. Попробуйте еще раз.'));
              return;
            }

            setStatus('Готовим товар...');
            window.setTimeout(tick, intervalMs);
          })
          .catch(function (error) {
            reject(error);
          });
      }

      tick();
    });
  }

  function submitGeneratedVariant(variantId) {
    var quantity = parsePositiveInteger(elements.quantity && elements.quantity.value) || 1;
    var form = document.createElement('form');
    form.method = 'post';
    form.action = '/cart_items';
    form.hidden = true;

    var variantInput = document.createElement('input');
    variantInput.type = 'hidden';
    variantInput.name = 'variant_id';
    variantInput.value = String(variantId);
    form.appendChild(variantInput);

    var quantityInput = document.createElement('input');
    quantityInput.type = 'hidden';
    quantityInput.name = 'quantity';
    quantityInput.value = String(quantity);
    form.appendChild(quantityInput);

    document.body.appendChild(form);
    form.submit();
  }

  function loadProduct(productId) {
    if (window.Products && typeof window.Products.get === 'function') {
      return new Promise(function (resolve, reject) {
        window.Products.get(productId)
          .done(function (product) {
            resolve(product);
          })
          .fail(function (error) {
            reject(error);
          });
      });
    }

    return fetch('/products_by_id/' + productId + '.json', {
      headers: {
        Accept: 'application/json',
      },
    }).then(parseJsonResponse);
  }

  function setStatus(message) {
    if (!elements.status) {
      return;
    }

    elements.status.hidden = !message;
    elements.status.textContent = message || '';
  }

  function clearStatus() {
    setStatus('');
  }

  function lockSubmit(locked) {
    if (!elements.submit) {
      return;
    }

    elements.submit.disabled = Boolean(locked);
  }
}

function collectOptionGroups(variants) {
  var map = {};

  variants.forEach(function (variant) {
    (variant.option_values || []).forEach(function (optionValue) {
      var key = buildOptionKey(optionValue.option_name_id, optionValue.option_name);
      if (!map[key]) {
        map[key] = {
          key: key,
          title: optionValue.option_name,
          values: [],
        };
      }

      if (!map[key].values.some(function (item) { return item.value === optionValue.title; })) {
        map[key].values.push({
          value: optionValue.title,
        });
      }
    });
  });

  return Object.keys(map).map(function (key) {
    return map[key];
  });
}

function buildOptionKey(optionId, optionName) {
  var suffix = slugify(optionName || 'option');
  if (optionId) {
    return 'option-' + optionId + '-' + suffix;
  }
  return 'option-' + suffix;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'option';
}

function parseCatalog(node) {
  if (!node) {
    return [];
  }

  try {
    var parsed = JSON.parse(node.textContent || '[]');
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(function (item) {
      return item && item.id;
    });
  } catch (error) {
    console.error(error);
    return [];
  }
}

function parseJsonResponse(response) {
  if (!response.ok) {
    return response.json()
      .catch(function () {
        return null;
      })
      .then(function (payload) {
        var message = payload && (payload.message || payload.error || payload.errorText);
        throw new Error(message || 'Ошибка запроса.');
      });
  }

  return response.json();
}

function normalizeBackendUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function parseBoolean(value) {
  return value === true || value === 'true';
}

function parsePositiveInteger(value) {
  var parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatMoney(value) {
  var numeric = Number(value || 0);
  return new Intl.NumberFormat('ru-RU').format(numeric) + ' ₽';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getUserErrorMessage(error) {
  var message = error && error.message ? error.message : 'Не удалось подготовить товар. Попробуйте еще раз.';

  if (/network/i.test(message)) {
    return 'Проблема с соединением. Попробуйте еще раз.';
  }

  return message;
}
