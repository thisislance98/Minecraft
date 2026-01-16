
export class RecipeBook {
    constructor(game, manager, inventoryUI) {
        this.game = game;
        this.manager = manager;
        this.inventoryUI = inventoryUI;
        this.isVisible = false;

        this.setupRecipeBookUI();
    }

    setupRecipeBookUI() {
        // Create Recipe Book Icon in Inventory (will be appended by Inventory.js)
        this.bookIcon = document.createElement('div');
        this.bookIcon.id = 'recipe-book-icon';
        this.bookIcon.className = 'recipe-book-icon';
        this.bookIcon.innerHTML = `
            <svg viewBox="0 0 64 64" width="100%" height="100%">
               <rect x="10" y="8" width="44" height="48" rx="2" fill="#5C4033" stroke="#3e2b1e" stroke-width="2"/>
               <rect x="14" y="12" width="36" height="40" fill="#f0e68c" opacity="0.8"/>
               <path d="M20 20 L40 20 M20 30 L40 30 M20 40 L30 40" stroke="#5c402d" stroke-width="2" opacity="0.6"/>
            </svg>
        `;
        this.bookIcon.title = "Recipe Book";
        this.bookIcon.onclick = () => this.toggle();

        // Create Recipe Panel
        this.panel = document.createElement('div');
        this.panel.id = 'recipe-panel';
        this.panel.className = 'recipe-panel hidden';
        this.panel.innerHTML = `
            <div class="recipe-header">
                <h3>Crafting Recipes</h3>
                <button class="close-btn">X</button>
            </div>
            <div class="recipe-list" id="recipe-list"></div>
        `;

        document.body.appendChild(this.panel);

        this.panel.querySelector('.close-btn').onclick = () => this.hide();

        // Populate specific container if existing, else we might need to rely on Inventory to append the icon.
    }

    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }

    show() {
        this.isVisible = true;
        this.panel.classList.remove('hidden');
        this.renderRecipes();
    }

    hide() {
        this.isVisible = false;
        this.panel.classList.add('hidden');
    }

    renderRecipes() {
        const list = this.panel.querySelector('#recipe-list');
        list.innerHTML = '';

        const recipes = this.manager.recipes;

        recipes.forEach(recipe => {
            const recipeEl = document.createElement('div');
            recipeEl.className = 'recipe-item';

            // Result Icon
            const resultIcon = document.createElement('div');
            resultIcon.className = 'recipe-result';
            resultIcon.innerHTML = this.inventoryUI.getItemIcon(recipe.result.item) + `<span>${recipe.result.count > 1 ? recipe.result.count : ''}</span>`;

            // Ingredients List
            const ingredientsEl = document.createElement('div');
            ingredientsEl.className = 'recipe-ingredients';

            recipe.ingredients.forEach(ing => {
                const ingEl = document.createElement('div');
                ingEl.className = 'recipe-ingredient';
                ingEl.innerHTML = this.inventoryUI.getItemIcon(ing.item) + `<span>${ing.count}</span>`;
                ingEl.title = ing.item;
                ingredientsEl.appendChild(ingEl);
            });

            recipeEl.appendChild(resultIcon);
            recipeEl.appendChild(document.createTextNode('=')); // Visual separator
            recipeEl.appendChild(ingredientsEl);

            // Optional: Click to Autofill (if we want to go fancy, but maybe later)
            // recipeEl.onclick = () => this.tryCraft(recipe);

            list.appendChild(recipeEl);
        });
    }
}
