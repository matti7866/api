import React from 'react';
import { Route, withRouter } from 'react-router-dom';
import routes from './../../config/app-route.jsx';
import { AppSettings } from './../../config/app-settings.js';

function setTitle(path, routeArray) {
	var appTitle;
	for (var i=0; i < routeArray.length; i++) {
		if (routeArray[i].path === path) {
			appTitle = 'Color Admin | ' + routeArray[i].title;
		}
	}
	document.title = (appTitle) ? appTitle : 'Color Admin | React App';
}

class Content extends React.Component {
	componentDidMount() {
		setTitle(this.props.history.location.pathname, routes);
	}
	componentWillMount() {
    this.props.history.listen(() => {
			setTitle(this.props.history.location.pathname, routes);
    });
  }
  
	render() {
		return (
			<AppSettings.Consumer>
				{({appContentClass}) => (
					<div className={'app-content '+ appContentClass}>
						{routes.map((route, index) => (
							<Route
								key={index}
								path={route.path}
								exact={route.exact}
								component={route.component}
							/>
						))}
					</div>
				)
			}
			</AppSettings.Consumer>
		)
	}
}

export default withRouter(Content);
