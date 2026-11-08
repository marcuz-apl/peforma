import React, { useState } from 'react';
import { ArrowLeftRight, ChevronDown } from 'lucide-react';
import { CATEGORIES, convertValue, findUnit, formatNumber, getCategory } from './units.js';

export default function UnitConverter() {
  const [categoryKey, setCategoryKey] = useState(CATEGORIES[0].key);
  const category = getCategory(categoryKey);
  const [fromKey, setFromKey] = useState(category.defaultFrom);
  const [toKey, setToKey] = useState(category.defaultTo);
  const [value, setValue] = useState('1');

  const from = findUnit(category, fromKey);
  const to = findUnit(category, toKey);
  const numeric = value.trim() === '' ? NaN : Number(value);
  const display = formatNumber(convertValue(category, numeric, fromKey, toKey));

  const selectCategory = next => {
    setCategoryKey(next.key);
    setFromKey(next.defaultFrom);
    setToKey(next.defaultTo);
  };

  const swap = () => {
    setFromKey(toKey);
    setToKey(fromKey);
  };

  return (
    <section className="workspace units-workspace" aria-label="Unit converter">
      <div className="unit-block">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">01 <span>·</span> CATEGORY</div>
            <h2>Choose a category</h2>
          </div>
        </div>
        <div className="category-chips" role="group" aria-label="Conversion category">
          {CATEGORIES.map(item => (
            <button
              key={item.key}
              type="button"
              className="category-chip"
              aria-pressed={item.key === category.key}
              onClick={() => selectCategory(item)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      <div className="unit-block">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">02 <span>·</span> CONVERSION</div>
            <h2>Convert {category.name.toLowerCase()}</h2>
          </div>
        </div>
        <div className="conversion-row">
          <div className="convert-field">
            <label className="field-label" htmlFor="unit-value">Value</label>
            <input
              id="unit-value"
              className="unit-input"
              type="number"
              inputMode="decimal"
              step="any"
              value={value}
              onChange={event => setValue(event.target.value)}
            />
            <label className="field-label" htmlFor="unit-from">From unit</label>
            <div className="format-select">
              <select id="unit-from" value={fromKey} onChange={event => setFromKey(event.target.value)}>
                {category.units.map(unit => <option key={unit.key} value={unit.key}>{unit.label}</option>)}
              </select>
              <ChevronDown size={14} />
            </div>
          </div>

          <button type="button" className="swap-button" onClick={swap} aria-label="Swap units" title="Swap units">
            <ArrowLeftRight size={16} />
          </button>

          <div className="convert-field">
            <span className="field-label">Result</span>
            <output className="unit-output" aria-live="polite">
              <span>{display}</span>{' '}
              <span className="unit-output-unit">{to.symbol}</span>
            </output>
            <label className="field-label" htmlFor="unit-to">To unit</label>
            <div className="format-select">
              <select id="unit-to" value={toKey} onChange={event => setToKey(event.target.value)}>
                {category.units.map(unit => <option key={unit.key} value={unit.key}>{unit.label}</option>)}
              </select>
              <ChevronDown size={14} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
