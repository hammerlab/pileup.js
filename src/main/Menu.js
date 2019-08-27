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


import { SketchPicker } from 'react-color';
import React from 'react';

// RGBA = red, green, blue, alpha
// each value is between 0 and 1
type RGBA = {
    r: number, g: number, b: number, a: number
};

// some color pickers require hex as color input,
// others require rgb
type ColorItem = {
    hex: string,
    rgb: RGBA
};

type MenuItem = {
  key: string;
  label: string;
  checked?: boolean;
  color?: ColorItem;
};

type Props = {
  header: string;
  items: Array<MenuItem|'-'>;
  onClick: (item: Object) => void;
};

type State = {
  // list of booleans determining whether to show color palette for MenuItem
  showPalette: boolean[];
};

class Menu extends React.Component<Props, State> {
  props: Props;
  state: State;

  constructor(props: Object) {
      super(props);
      this.state = {
        showPalette: new Array(props.items.length).fill(false)
      };
  }

  // toggle color picker for menu items that have color enabled
  toggleColorPicker(key: number, e: SyntheticEvent<>) {
    if (this.state.showPalette[key] == false) {
      this.state.showPalette[key] = true
      this.setState({showPalette: this.state.showPalette});
    } else {
        this.state.showPalette[key] = false
        this.setState({showPalette: this.state.showPalette});
    }
  }

  clickHandler(idx: number, e: SyntheticMouseEvent<>, togglePicker: boolean = true) {
    // do not call preventDefault on nullified events to avoid warnings
    if (e.eventPhase != null) {
        e.preventDefault();
    }
    var item = this.props.items[idx];
    if (typeof(item) == 'string') return;  // for flow

    // propogate root update if new opts do not == old opts
    this.props.onClick(item);

    if (item.color && togglePicker) {
        this.toggleColorPicker(idx, e)
    }
  }

  handleColorChange(idx: number, color: Object, e: SyntheticMouseEvent<>) {
      // update both hex and rgb values
      if (typeof(this.props.items[idx]) == 'string') return;  // for flow not working
      if (typeof(this.props.items[idx]) === 'undefined') return;  // for flow not working
      this.props.items[idx].color = {
          'hex': color.hex,
          'rgb': color.rgb
      };
      this.clickHandler(idx, e, false);
  };

  render(): any {
    var makeHandler = i => this.clickHandler.bind(this, i);
    var makeColorPickerHandler = i => this.handleColorChange.bind(this, i);

    var els = [];
    if (this.props.header) {
      els.push(<div key='header' className='menu-header'>{this.props.header}</div>);
    }
    els = els.concat(this.props.items.map((item, i) => {
      if (typeof(item) === 'string') {  // would prefer "== '-'", see flow#1066
        return <div key={i} className='menu-separator' />;
      } else {
        var checkClass = 'check' + (item.checked ? ' checked' : '');
        // initially hide color picker
        if (typeof(item) != 'string' && item.color) {
            var colorPicker = null

            if (this.state.showPalette[i]) {
                colorPicker = (
                    <SketchPicker
                        color={item.color.rgb}
                        onChangeComplete={ makeColorPickerHandler(i) }
                    />)
            }

            return (
              <div key={i} className='menu-item' >
                <span className={checkClass}></span>
                <span key={i} onClick={makeHandler(i)} className='menu-item-label'>{item.label}</span>
                {colorPicker}
              </div>
            );
        } else {
            return (
              <div key={i} className='menu-item' onClick={makeHandler(i)}>
                <span className={checkClass}></span>
                <span className='menu-item-label'>{item.label}</span>
              </div>
            );
        }
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
