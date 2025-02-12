class EligibilityService {
  findValueFromNestedobject(obj, conditionKey) {
    console.log("labels", conditionKey, obj);
    const resultValue = this.deepGetByPaths(obj, conditionKey);
    console.log("dig", resultValue);
    return resultValue;
  }

  // Dig inside nested objects and return the found value
  deepGet(obj, keys) {
    console.log("this.deepGet", obj[keys[0]], keys, obj, keys.slice(1));
    // If we have an array as a value of a key inside our cart : { products: [{ productId: value }, { productId: value2}] }
    // We return an array of the values corresponding to the key [value, value2]
    if (Array.isArray(obj[keys[0]])) {
      const searchValues = [];
      obj[keys[0]].forEach((item) =>
        searchValues.push(
          keys.slice(1).reduce((xs, x) => xs?.[x] ?? null, item)
        )
      );
      console.log("search,", searchValues);
      return searchValues;
    }
    // If we have a object as a value of a key inside our cart : { products: { productId: value } }
    // We return the value directly inside an array [value]
    else {
      console.log("else");
      return [keys.reduce((xs, x) => xs?.[x] ?? null, obj)];
    }
  }

  deepGetByPaths(obj, path) {
    console.log("obj", path);
    return this.deepGet(
      obj,
      path
        .replace(/\[([^\[\]]*)\]/g, ".$1.")
        .split(".")
        .filter((t) => t !== "")
    );
  }

  isValidDate(dateString) {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  compareCartWithCriteria(keyCondition, valueCondition, valuesFromCart) {
    console.log("inside", keyCondition, valueCondition, valuesFromCart);
    const comparisonResults = [];

    valuesFromCart.forEach((valueFromCart) => {
      if (keyCondition === "gt") {
        console.log("gt");
        const result = this.isValidDate(valueFromCart)
          ? new Date(valueFromCart).getTime() >
            new Date(valueCondition).getTime()
          : Number(valueFromCart) > Number(valueCondition);
        comparisonResults.push(result);
      } else if (keyCondition === "lt") {
        console.log("lt");
        const result = this.isValidDate(valueFromCart)
          ? new Date(valueFromCart).getTime() <
            new Date(valueCondition).getTime()
          : Number(valueFromCart) < Number(valueCondition);
        comparisonResults.push(result);
      } else if (keyCondition === "gte") {
        console.log("gte");
        const result = this.isValidDate(valueFromCart)
          ? new Date(valueFromCart).getTime() >=
            new Date(valueCondition).getTime()
          : Number(valueFromCart) >= Number(valueCondition);
        comparisonResults.push(result);
      } else if (keyCondition === "lte") {
        console.log("lte");
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
   * @param conditions
   * @param conditionKey
   */
  checkConditionByKey(cart, conditions, conditionKey) {
    const valuesFromCart = this.findValueFromNestedobject(cart, conditionKey);

    const valueOperators = ["gt", "lt", "gte", "lte"];
    const multipleConditionsOperators = ["in", "or", "and"];

    const valueFromCriteria = conditions[conditionKey];

    const operatorInCondition = Object.keys(valueFromCriteria)[0];

    console.log(
      "check condiciotn",
      valuesFromCart,
      conditionKey,
      valueFromCriteria,
      operatorInCondition,
      valueOperators.includes(operatorInCondition),
      multipleConditionsOperators.includes(operatorInCondition)
    );

    // If we have multiple operators, we need to check condition differently
    if (
      valueFromCriteria &&
      multipleConditionsOperators.includes(operatorInCondition)
    ) {
      if (operatorInCondition === "and") {
        const validity = [];
        for (const [key, value] of Object.entries(valueFromCriteria["and"])) {
          validity.push(
            this.compareCartWithCriteria(key, value, valuesFromCart)
          );
        }
        console.log("validity and", validity, !validity.includes(false));
        return !validity.includes(false);
      } else if (operatorInCondition === "or") {
        const validity = [];
        for (const [key, value] of Object.entries(valueFromCriteria["or"])) {
          validity.push(
            this.compareCartWithCriteria(key, value, valuesFromCart)
          );
        }
        console.log("validity or", validity, validity.includes(true));
        return validity.includes(true);
      } else if (operatorInCondition === "in") {
        console.log(
          "validity in",
          Object.values(valueFromCriteria)[0],
          valuesFromCart,
          Object.values(valueFromCriteria)[0].includes(valuesFromCart)
        );
        return valuesFromCart.includes(Object.values(valueFromCriteria)[0]);
      }
    }
    // If we have a comparison operator only, it will only have one key like {gt: 50} => ['gt']
    else if (
      valueFromCriteria &&
      valueOperators.includes(operatorInCondition)
    ) {
      console.log(
        "condition 1 only",
        valuesFromCart[0],
        // result,
        Object.values(valueFromCriteria)[0]
      );
      const result = this.compareCartWithCriteria(
        operatorInCondition,
        Object.values(valueFromCriteria)[0],
        valuesFromCart
      );
      return result;
    }
    // We only have to check if the value equals the basic condition
    else {
      console.log("basic condition", valueFromCriteria, valuesFromCart);
      return valueFromCriteria === valuesFromCart[0];
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
    // Without criteria, the cart is always eligible
    if (
      (criteriaKeys.lenght == 0 && Object.keys(cart).lenght == 0) ||
      (criteriaKeys.lenght == 0 && Object.keys(cart).lenght > 0)
    ) {
      return true;
    }

    // Without cart and with criteria, the cart is always not eligible
    if (criteriaKeys.lenght > 0 && Object.keys(cart).lenght == 0) return false;

    // Store the validity of each condition
    const allValidities = [];

    // Check for each condition of the criteria if the corresponding one in the chart fullfil it
    criteriaKeys.forEach((item) => {
      allValidities.push(this.checkConditionByKey(cart, criteria, item));
      console.log("All ", allValidities);
    });

    return !allValidities.includes(false);
  }
}

module.exports = {
  EligibilityService,
};
