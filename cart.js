// cart.js - Gerenciamento do Carrinho Noble Acabamentos

const CART_STORAGE_KEY = 'noble_cart';

const Cart = {
    // Busca os itens do localStorage
    getItems() {
        const stored = localStorage.getItem(CART_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    },

    // Salva os itens no localStorage
    saveItems(items) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        // Dispara um evento customizado para atualizar o contador no header
        window.dispatchEvent(new CustomEvent('cart-updated'));
    },

    // Adiciona um item ao carrinho
    addItem(product, quantity = 1) {
        const items = this.getItems();
        const existingItemIndex = items.findIndex(item => item.id === product.id);

        if (existingItemIndex > -1) {
            items[existingItemIndex].quantity += quantity;
        } else {
            items.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                brand: product.brand,
                color: product.color,
                quantity: quantity
            });
        }

        this.saveItems(items);

        // Dispara evento do Facebook Pixel
        if (typeof fbq === 'function') {
            fbq('track', 'AddToCart', {
                content_ids: [product.id],
                content_name: product.name,
                content_type: 'product',
                value: product.price * (quantity || 1),
                currency: 'BRL'
            });
        }

        return items;
    },

    // Remove um item do carrinho
    removeItem(productId) {
        let items = this.getItems();
        items = items.filter(item => item.id !== productId);
        this.saveItems(items);
        return items;
    },

    // Atualiza a quantidade de um item
    updateQuantity(productId, quantity) {
        if (quantity <= 0) return this.removeItem(productId);

        const items = this.getItems();
        const itemIndex = items.findIndex(item => item.id === productId);

        if (itemIndex > -1) {
            items[itemIndex].quantity = quantity;
            this.saveItems(items);
        }
        return items;
    },

    // Limpa o carrinho
    clear() {
        localStorage.removeItem(CART_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent('cart-updated'));
    },

    // Conta total de itens (unidades)
    countItems() {
        return this.getItems().reduce((total, item) => total + item.quantity, 0);
    },

    // Calcula o total em R$
    getTotal() {
        return this.getItems().reduce((total, item) => total + (item.price * item.quantity), 0);
    }
};

// Listener para o contador do header (para rodar em todas as páginas)
document.addEventListener('DOMContentLoaded', () => {
    const updateCounter = () => {
        const counter = document.getElementById('cart-count');
        if (counter) {
            const count = Cart.countItems();
            counter.textContent = count;
            counter.style.display = count > 0 ? 'flex' : 'none';
        }
    };

    // Mobile Menu Toggle
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            menuBtn.classList.toggle('active');
            navLinks.classList.toggle('active');
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });

        // Fechar menu ao clicar em um link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                menuBtn.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    updateCounter();
    window.addEventListener('cart-updated', updateCounter);
});
