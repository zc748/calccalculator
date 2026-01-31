from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sympy as sp
from sympy import *
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
import numpy as np
import json
import traceback

app = Flask(__name__, static_folder='static')
CORS(app)

# Configure SymPy
x, y, z, t, n = symbols('x y z t n')
sp.init_printing(use_unicode=True)

def safe_parse(expression_str):
    """Safely parse mathematical expressions"""
    try:
        # Replace common patterns
        expression_str = expression_str.replace('^', '**')
        expression_str = expression_str.replace('√', 'sqrt')
        
        transformations = (standard_transformations + (implicit_multiplication_application,))
        expr = parse_expr(
            expression_str, 
            transformations=transformations, 
            local_dict={
                'e': sp.E, 
                'pi': sp.pi,
                'π': sp.pi,
                'sin': sp.sin,
                'cos': sp.cos,
                'tan': sp.tan,
                'ln': sp.ln,
                'log': sp.log,
                'sqrt': sp.sqrt,
                'exp': sp.exp
            }
        )
        return expr
    except Exception as e:
        raise ValueError(f"Could not parse expression: {str(e)}")

def format_latex(expr):
    """Convert SymPy expression to LaTeX"""
    try:
        return sp.latex(expr)
    except:
        return str(expr)

def get_steps(operation, expr, **kwargs):
    """Generate step-by-step solutions"""
    steps = []
    
    if operation == 'derivative':
        var = kwargs.get('variable', x)
        order = kwargs.get('order', 1)
        
        steps.append({
            'title': 'Original Function',
            'expression': format_latex(expr),
            'explanation': f'Find the {"" if order == 1 else str(order) + "th "}derivative with respect to {var}'
        })
        
        current = expr
        for i in range(order):
            result = sp.diff(current, var)
            steps.append({
                'title': f'{"First" if i == 0 else "Next"} Derivative',
                'expression': format_latex(result),
                'explanation': 'Apply differentiation rules'
            })
            current = result
        
        simplified = sp.simplify(current)
        if simplified != current:
            steps.append({
                'title': 'Simplified',
                'expression': format_latex(simplified),
                'explanation': 'Simplify the result'
            })
    
    elif operation == 'integral':
        var = kwargs.get('variable', x)
        steps.append({
            'title': 'Original Function',
            'expression': format_latex(expr),
            'explanation': f'Find the integral with respect to {var}'
        })
        
        result = sp.integrate(expr, var)
        steps.append({
            'title': 'Antiderivative',
            'expression': format_latex(result) + ' + C',
            'explanation': 'Apply integration rules'
        })
    
    elif operation == 'limit':
        var = kwargs.get('variable', x)
        point = kwargs.get('point', 0)
        
        steps.append({
            'title': 'Original Expression',
            'expression': format_latex(expr),
            'explanation': f'Evaluate limit as {var} → {point}'
        })
        
        result = sp.limit(expr, var, point)
        steps.append({
            'title': 'Limit',
            'expression': format_latex(result),
            'explanation': 'Direct substitution or L\'Hôpital\'s rule'
        })
    
    elif operation == 'series':
        var = kwargs.get('variable', x)
        point = kwargs.get('point', 0)
        n_terms = kwargs.get('terms', 6)
        
        steps.append({
            'title': 'Taylor Series',
            'expression': format_latex(expr),
            'explanation': f'Expand around {var} = {point}'
        })
        
        result = sp.series(expr, var, point, n_terms)
        steps.append({
            'title': 'Series Expansion',
            'expression': format_latex(result),
            'explanation': f'Terms up to O({var}^{n_terms})'
        })
    
    elif operation == 'solve':
        var = kwargs.get('variable', x)
        solutions = sp.solve(expr, var)
        
        steps.append({
            'title': 'Equation',
            'expression': format_latex(expr) + ' = 0',
            'explanation': f'Solve for {var}'
        })
        
        if solutions:
            sol_str = ', '.join([format_latex(sol) for sol in solutions])
            steps.append({
                'title': 'Solutions',
                'expression': sol_str,
                'explanation': f'Found {len(solutions)} solution(s)'
            })
    
    return steps

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

@app.route('/api/calculate', methods=['POST'])
def calculate():
    try:
        data = request.json
        operation = data.get('operation')
        expression_str = data.get('expression', '')
        
        if not expression_str:
            return jsonify({'error': 'No expression provided'}), 400
        
        # Parse expression
        expr = safe_parse(expression_str)
        
        result = None
        steps = []
        graph_data = None
        
        if operation == 'derivative':
            var_str = data.get('variable', 'x')
            var = symbols(var_str)
            order = int(data.get('order', 1))
            
            for _ in range(order):
                expr = sp.diff(expr, var)
            
            result = expr
            steps = get_steps('derivative', safe_parse(expression_str), variable=var, order=order)
            
            # Generate graph data
            try:
                original = safe_parse(expression_str)
                f = sp.lambdify(var, original, 'numpy')
                f_prime = sp.lambdify(var, result, 'numpy')
                x_vals = np.linspace(-10, 10, 200)
                y_vals = f(x_vals)
                y_prime_vals = f_prime(x_vals)
                
                mask = np.isfinite(y_vals) & np.isfinite(y_prime_vals)
                
                graph_data = {
                    'original': {
                        'x': x_vals[mask].tolist(),
                        'y': y_vals[mask].tolist(),
                        'label': 'f(x)'
                    },
                    'derivative': {
                        'x': x_vals[mask].tolist(),
                        'y': y_prime_vals[mask].tolist(),
                        'label': f"f{'′' * order}(x)"
                    }
                }
            except:
                pass
        
        elif operation == 'integral':
            var_str = data.get('variable', 'x')
            var = symbols(var_str)
            
            if data.get('definite'):
                lower = float(data.get('lower', 0))
                upper = float(data.get('upper', 1))
                result = sp.integrate(expr, (var, lower, upper))
            else:
                result = sp.integrate(expr, var)
            
            steps = get_steps('integral', expr, variable=var)
            
            # Generate graph
            try:
                f = sp.lambdify(var, expr, 'numpy')
                x_vals = np.linspace(-10, 10, 200)
                y_vals = f(x_vals)
                mask = np.isfinite(y_vals)
                
                graph_data = {
                    'function': {
                        'x': x_vals[mask].tolist(),
                        'y': y_vals[mask].tolist(),
                        'label': 'f(x)'
                    }
                }
            except:
                pass
        
        elif operation == 'limit':
            var_str = data.get('variable', 'x')
            var = symbols(var_str)
            point = data.get('point', 0)
            
            # Try to parse point
            try:
                point = float(point)
            except:
                point = 0
            
            result = sp.limit(expr, var, point)
            steps = get_steps('limit', expr, variable=var, point=point)
        
        elif operation == 'series':
            var_str = data.get('variable', 'x')
            var = symbols(var_str)
            point = data.get('point', 0)
            n_terms = int(data.get('terms', 6))
            
            result = sp.series(expr, var, point, n_terms).removeO()
            steps = get_steps('series', expr, variable=var, point=point, terms=n_terms)
        
        elif operation == 'solve':
            var_str = data.get('variable', 'x')
            var = symbols(var_str)
            solutions = sp.solve(expr, var)
            
            steps = get_steps('solve', expr, variable=var)
            result = solutions
        
        else:
            return jsonify({'error': 'Unknown operation'}), 400
        
        # Format result
        if isinstance(result, list):
            result_latex = [format_latex(r) for r in result]
            result_text = [str(r) for r in result]
        else:
            result_latex = format_latex(result)
            result_text = str(result)
        
        return jsonify({
            'success': True,
            'result': result_latex,
            'result_text': result_text,
            'steps': steps,
            'graph': graph_data
        })
    
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
