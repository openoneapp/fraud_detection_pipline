import joblib

import numpy as np

from sklearn.ensemble import RandomForestClassifier

# Feature order

X = np.array([

    [
        100,
        720,
        1,
        1,
        0,
        1,
        100,
        10,
        5
    ],

    [
        100000,
        2,
        50,
        20,
        10,
        100,
        1000000,
        90,
        500
    ],

    [
        500,
        100,
        2,
        1,
        0,
        2,
        1000,
        3,
        10
    ],

    [
        200000,
        1,
        100,
        50,
        20,
        200,
        5000000,
        100,
        1000
    ]

])


y = np.array([

    0,

    1,

    0,

    1

])


model = RandomForestClassifier(

    n_estimators=100,

    random_state=42

)


model.fit(
    X,
    y
)


joblib.dump(

    model,

    "app/models/fraud_model.pkl"

)


print(
    "Model trained successfully"
)