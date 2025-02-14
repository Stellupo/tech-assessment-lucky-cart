class EligibilityService {
  /**
   * From a path string from criteria (ex: 'products.productId'), find the sub-object value inside our cart
   * Ex: path = 'products.productId', cart = { products: [{ productId: value }, { productId: value2}] } => [value, value2] is returned
   *
   * @param obj - our cart
   * @param {string} path
   * @returns {[]}
   **/
  findSubObjectValueFromPath(obj, path) {
    return this.digInObjByKeys(
      obj,
      path
        .replace(/\[([^\[\]]*)\]/g, ".$1.")
        .split(".")
        .filter((t) => t !== "")
    );
  }

  /**
   * From an array of strings (ex: ['product', 'productId']), dig into obj key by key (ex: obj.product => obj.product.productId)
   *
   * @param obj - our cart
   * @param {string[]} keys
   * @returns {[]}
   **/
  digInObjByKeys(obj, keys) {
    // If we have an array as a value of a key inside our cart : { products: [{ productId: value }] }
    // Only works when we have one level of depth
    if (Array.isArray(obj[keys[0]])) {
      const searchValues = [];
      obj[keys[0]].forEach((item) =>
        searchValues.push(
          keys.slice(1).reduce((xs, x) => xs?.[x] ?? null, item)
        )
      );
      return searchValues;
    }
    // If we have a object as a value of a key inside our cart : { products: { productId: value } }
    else {
      return [keys.reduce((xs, x) => xs?.[x] ?? null, obj)];
    }
  }

  isValidDate(dateString) {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  convertToString(item) {
    return typeof item === "number" ? String(item) : item;
  }

  /**
   * Compare the condition value and each value of the cart regarding the operator.
   * If one value is a date, we apply a different comparison to get relevent results.
   * Otherwise, we compare the values as number.
   *
   * @param {string} operator
   * @param valueCondition 
   * @param {[]} valuesFromCart
   * @returns {[]}
   **/
  compareCartWithCriteria(operator, valueCondition, valuesFromCart) {
    const comparisonResults = [];

    valuesFromCart.forEach((valueFromCart) => {
      if (operator === "gt") {
        const result = this.isValidDate(valueFromCart)
          ? new Date(valueFromCart).getTime() >
            new Date(valueCondition).getTime()
          : Number(valueFromCart) > Number(valueCondition);
        comparisonResults.push(result);
      } else if (operator === "lt") {
        const result = this.isValidDate(valueFromCart)
          ? new Date(valueFromCart).getTime() <
            new Date(valueCondition).getTime()
          : Number(valueFromCart) < Number(valueCondition);
        comparisonResults.push(result);
      } else if (operator === "gte") {
        const result = this.isValidDate(valueFromCart)
          ? new Date(valueFromCart).getTime() >=
            new Date(valueCondition).getTime()
          : Number(valueFromCart) >= Number(valueCondition);
        comparisonResults.push(result);
      } else if (operator === "lte") {
        const result = this.isValidDate(valueFromCart)
          ? new Date(valueFromCart).getTime() <=
            new Date(valueCondition).getTime()
          : Number(valueFromCart) <= Number(valueCondition);
        comparisonResults.push(result);
      }
    });

    return comparisonResults.includes(true);
  }


  /**
   * Check if a cart element value fulfill the condition from the criteria.
   * The comparison complexity depends on the operators inside the criteria (or, in , gt, etc.)
   *
   * @param cart
   * @param criteria
   * @param criteriaKey
   * @returns {boolean}
   */
  checkConditionByKey(cart, criteria, criteriaKey) {
    const valuesFromCart = this.findSubObjectValueFromPath(cart, criteriaKey);

    const valueOperators = ["gt", "lt", "gte", "lte"];
    const multipleConditionsOperators = ["in", "or", "and"];

    const valueFromCriteria = criteria[criteriaKey];

    const operatorInCondition = Object.keys(valueFromCriteria)[0];

    // Handling IN, OR, AND operators
    if (
      valueFromCriteria &&
      multipleConditionsOperators.includes(operatorInCondition)
    ) {
      // AND
      if (operatorInCondition === "and") {
        const validity = [];
        for (const [key, value] of Object.entries(
          valueFromCriteria[operatorInCondition]
        )) {
          validity.push(
            this.compareCartWithCriteria(key, value, valuesFromCart)
          );
        }
        return !validity.includes(false);
      }
      // OR
      else if (operatorInCondition === "or") {
        const validity = [];
        for (const [key, value] of Object.entries(
          valueFromCriteria[operatorInCondition]
        )) {
          validity.push(
            this.compareCartWithCriteria(key, value, valuesFromCart)
          );
        }
        return validity.includes(true);
      }
      // IN
      else if (operatorInCondition === "in") {
        // Condition valid if we have at least one of the values from the criteria in the cart values
        const cartElementIsValid = valueFromCriteria[operatorInCondition].some(
          (item) => valuesFromCart.includes(item)
        );
        return cartElementIsValid;
      }
    }
    // Handling GT, LT, GTE, LTE operators
    else if (
      valueFromCriteria &&
      valueOperators.includes(operatorInCondition)
    ) {
      return this.compareCartWithCriteria(
        operatorInCondition,
        valueFromCriteria[operatorInCondition],
        valuesFromCart
      );
    }
    // We only have to check if the value equals the condition
    else {
      // The cart element value is a simple one (ex: cart = {quantity:1})
      if (valuesFromCart.length === 1)
        return (
          this.convertToString(valueFromCriteria) ===
          this.convertToString(valuesFromCart[0])
        );
      // The cart element value is an array (ex : cart = {products:[{quantity:1}, {quantity: 2}]} )
      else {
        return valuesFromCart
          .map((item) => String(item))
          .includes(this.convertToString(valueFromCriteria));
      }
    }
  }

  /**
   * Compare cart data with criteria to compute eligibility.
   * If all criteria are fulfilled then the cart is eligible (return true).
   *
   * @param cart
   * @param criteria
   * @return {boolean}
   */
  isEligible(cart, criteria) {
    const criteriaKeys = Object.keys(criteria);
    const cartKeys = Object.keys(cart);

    // Without criteria, the cart is always eligible
    if (
      (criteriaKeys.lenght == 0 && cartKeys.lenght == 0) ||
      (criteriaKeys.lenght == 0 && cartKeys.lenght > 0)
    ) {
      return true;
    }

    // Without cart and with criteria, the cart is always not eligible
    if (criteriaKeys.lenght > 0 && cartKeys.lenght == 0) return false;

    // Store the validity of each condition into an array
    const allValidities = [];

    // Check for each condition of the criteria if the corresponding one in the chart fullfil it
    criteriaKeys.forEach((item) => {
      allValidities.push(this.checkConditionByKey(cart, criteria, item));
    });

    return !allValidities.includes(false);
  }
}

module.exports = {
  EligibilityService,
};
