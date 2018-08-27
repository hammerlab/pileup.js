/**
 * A generic menu, intended to be used for both toggling options and invoking commands.
 *
 * Usage:
 *
 * var items = [
 *   {key: 'a', label: 'Item A', checked: true},
 *   {key: 'b', label: 'Item B'},
 *   '-',
 *   {key: 'random', label: 'Pick Random'}
 * ];
 * <Menu header="Header" items={items} onSelect={selectHandler} />
 *
 * @flow
 */

'use strict';

import React from 'react';

type MenuItem = {
  key: string;
  label: string;
  checked?: boolean;
};

type Props = {
  header: string;
  items: Array<MenuItem|'-'>;
  onSelect: (key: string) => void;
};

class Menu extends React.Component<Props> {
  props: Props;

  clickHandler(idx: number, e: SyntheticMouseEvent<>) {
    e.preventDefault();
    var item = this.props.items[idx];
    if (typeof(item) == 'string') return;  // for flow
    this.props.onSelect(item.key);
  }

  render(): any {
    var makeHandler = i => this.clickHandler.bind(this, i);
    var els = [];
    if (this.props.header) {
      els.push(<div key='header' className='menu-header'>{this.props.header}</div>);
    }
    els = els.concat(this.props.items.map((item, i) => {
      if (typeof(item) === 'string') {  // would prefer "== '-'", see flow#1066
        return <div key={i} className='menu-separator' />;
      } else {
        var checkClass = 'check' + (item.checked ? ' checked' : '');
        return (
          <div key={i} className='menu-item' onClick={makeHandler(i)}>
            <span className={checkClass}></span>
            <span className='menu-item-label'>{item.label}</span>
          </div>
        );
      }
    }));

    return (
      <div className='menu'>
        {els}
      </div>
    );
  }
}

module.exports = Menu;
