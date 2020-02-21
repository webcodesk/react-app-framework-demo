import forOwn from 'lodash/forOwn';
import uniqueId from 'lodash/uniqueId';
import isEmpty from 'lodash/isEmpty';
import get from 'lodash/get';
import isArray from 'lodash/isArray';
import isPlainObject from 'lodash/isObject';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ErrorBoundary from './ErrorBoundary';
import NotFoundComponent from '../NotFoundComponent';
import createContainer from './Container';
import WarningComponent from '../WarningComponent';

class PageComposition extends Component {

  static propTypes = {
    userComponents: PropTypes.object,
    componentsTree: PropTypes.object,
    actionSequences: PropTypes.object,
    targets: PropTypes.object,
    routePath: PropTypes.string,
  };

  static defaultProps = {
    userComponents: {},
    componentsTree: {},
    actionSequences: {},
    targets: {},
    routePath: '',
  };

  constructor (props) {
    super(props);
    this.renderPage = this.renderPage.bind(this);
    this.renderComponent = this.renderComponent.bind(this);
  }

  renderShape (descriptionShape) {
    const result = {};
    forOwn(descriptionShape, (value, prop) => {
      if (value) {
        if (isArray(value)){
          result[prop] = this.renderArray(value);
        } else if (isPlainObject(value)) {
          if (value.type && value.instance) {
            result[prop] = this.renderComponent(value);
          } else {
            result[prop] = this.renderShape(value);
          }
        } else {
          result[prop] = value;
        }
      } else {
        result[prop] = value;
      }
    });
    return result;
  }

  renderArray (descriptionArray) {
    const result = [];
    if (descriptionArray.length > 0) {
      descriptionArray.forEach(descriptionItem => {
        if (descriptionItem) {
          if (isArray(descriptionItem)) {
            result.push(this.renderArray(descriptionItem));
          } else if (isPlainObject(descriptionItem)) {
            if (descriptionItem.type && descriptionItem.instance) {
              result.push(this.renderComponent(descriptionItem));
            } else {
              result.push(this.renderShape(descriptionItem));
            }
          } else {
            result.push(descriptionItem);
          }
        } else {
          result.push(descriptionItem);
        }
      });
    }
    return result;
  }

  renderComponent (description) {
    const {
      userComponents,
      actionSequences,
      targets,
    } = this.props;

    if (!description) {
      return null;
    }

    const { type, instance, key, props, children } = description;
    if (!type) {
      return null;
    }
    let propsComponents = {};
    if (props) {
      propsComponents = this.renderShape(props);
    }
    let nestedComponents = [];
    if (children && children.length > 0) {
      nestedComponents = children.map(child => {
        return this.renderComponent(child);
      });
    }
    if (propsComponents.children && isArray(propsComponents.children)) {
      nestedComponents = nestedComponents.concat(propsComponents.children);
      delete propsComponents.children;
    }
    const validType = type || 'div';
    if (validType.charAt(0) === '_') {
      const pageComponentType = validType.substr(1);
      return React.createElement(
        pageComponentType,
        { key: key || uniqueId(validType), ...props, ...propsComponents },
        nestedComponents
      );
    } else {
      // this is a user custom component, create container for it
      const wrappedComponent = get(userComponents, validType, null);
      if (!wrappedComponent) {
        return React.createElement(
          NotFoundComponent,
          { key: uniqueId('notFound'), componentName: validType }
        );
      }
      const { _doNotCreateContainer } = props || {};
      const containerKey = `${type}_${instance}`;

      if (_doNotCreateContainer) {
        return React.createElement(
          wrappedComponent,
          { key: key || uniqueId(validType), ...props, ...propsComponents },
          nestedComponents
        );
      }

      let containerHandlers = [];
      let componentKey;
      const actionSequence = actionSequences[containerKey];
      if (actionSequence) {
        containerHandlers = actionSequence.events;
        componentKey = actionSequence.componentKey;
      }
      const isTargetContainer = targets[containerKey];
      return createContainer(
        wrappedComponent,
        type,
        instance,
        componentKey,
        containerHandlers,
        isTargetContainer,
        {
          key: key || `${containerKey}_${uniqueId('c')}`,
          ...props,
          ...propsComponents
        },
        nestedComponents
      );
    }
  };

  renderPage () {
    const {componentsTree} = this.props;
    if (componentsTree && !isEmpty(componentsTree)) {
      return this.renderComponent(componentsTree);
    }
    return (<WarningComponent message="Page does not have components" />);
  }

  render () {
    return (
      <ErrorBoundary pageName={this.props.routePath}>
        {this.renderPage()}
      </ErrorBoundary>
    );
  }
}

export default PageComposition;
